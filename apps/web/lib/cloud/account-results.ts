/**
 * 账户页的 48 题结果列表读取。
 *
 * 与 quick-results / feedback-submissions 同样的理由抽成注入依赖的纯模块：
 * 真正要保证的是边界行为——未登录不发请求、任何网络故障都不抛给页面、
 * 服务端脏数据不把整页打穿——而本仓库没有 jsdom / RTL，组件里测不到这些。
 */

export interface AccountQuickResult {
  id: string;
  resultKey: string;
  contentVersion: string;
  createdAt: string;
  typeCode: string | null;
  domainCode: string | null;
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeRow(value: unknown): AccountQuickResult | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;

  const id = readString(row, "id");
  const createdAt = readString(row, "created_at");
  // 没有主键或时间的行无法展示也无法排序，直接丢弃；其余字段都可以缺。
  if (!id || !createdAt) return null;

  const payload =
    typeof row.result_payload === "object" && row.result_payload !== null
      ? (row.result_payload as Record<string, unknown>)
      : {};
  const personality =
    typeof payload.personality === "object" && payload.personality !== null
      ? (payload.personality as Record<string, unknown>)
      : {};

  return {
    id,
    resultKey: readString(row, "result_key") ?? "",
    // 版本只认这一列。迁移里有一条约束保证它与 payload 一致，但展示必须
    // 只听一个来源——否则约束一旦被绕过，页面会同时显示两个版本号。
    contentVersion: readString(row, "content_version") ?? "",
    createdAt,
    typeCode: readString(payload, "typeCode"),
    domainCode: readString(personality, "domain")
  };
}

/** 逐行归一化，丢弃无法展示的行。顺序保持服务端给的顺序（已按时间倒序）。 */
export function normalizeQuickResultRows(data: unknown): AccountQuickResult[] {
  if (!Array.isArray(data)) return [];
  const results: AccountQuickResult[] = [];
  for (const value of data) {
    const normalized = normalizeRow(value);
    if (normalized) results.push(normalized);
  }
  return results;
}

export interface AccountResultDependencies {
  currentUserId(): Promise<string | null>;
  /** PromiseLike so a PostgREST query builder can be passed without wrapping it. */
  list(ownerId: string): PromiseLike<{ data: unknown; error: unknown }>;
}

/**
 * 三种结果，因为对用户来说这是三件不同的事：
 *
 * - `ok` + 空列表 = 「查到了，你确实还没有记录」，可以放心引导去做测试；
 * - `signed_out` = 登录态在这期间失效了，该做的是重新登录；
 * - `unavailable` = 读不到，原因在网络上，和「有没有记录」无关。
 *
 * 早先把三者统一收敛成空数组，于是断网时账户页会对用户说「登录之后完成的
 * 48 题结果会出现在这里」——把一次读取失败说成了「你没有结果」。
 */
export type AccountResultsOutcome = "ok" | "signed_out" | "unavailable";

export interface AccountResultsSnapshot {
  outcome: AccountResultsOutcome;
  results: AccountQuickResult[];
}

const SIGNED_OUT: AccountResultsSnapshot = { outcome: "signed_out", results: [] };
const UNAVAILABLE: AccountResultsSnapshot = { outcome: "unavailable", results: [] };

/**
 * 读取当前用户自己的结果。
 *
 * 查询显式带上 owner_id：RLS 才是真正的隔离，但把过滤写进查询本身，
 * 让「只读自己」在请求里就是可见的，而不是藏在一个别处的策略里。
 *
 * 失败仍然不抛：账户页不该因为云端读不到就变成一张错误页——本机结果完好，
 * 用户没有什么必须立刻处理的事。区别只在于页面说实话，而不是假装没有记录。
 */
export async function fetchOwnQuickResults(deps: AccountResultDependencies): Promise<AccountResultsSnapshot> {
  let ownerId: string | null;
  try {
    ownerId = await deps.currentUserId();
  } catch {
    return SIGNED_OUT;
  }
  if (!ownerId) return SIGNED_OUT;

  try {
    const { data, error } = await deps.list(ownerId);
    if (error) return UNAVAILABLE;
    return { outcome: "ok", results: normalizeQuickResultRows(data) };
  } catch {
    return UNAVAILABLE;
  }
}
