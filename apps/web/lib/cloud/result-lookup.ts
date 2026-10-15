/**
 * 本机没有结果时，从账户里取回属于自己的那一条。
 *
 * 存在的理由：账户页列出的是云端历史，而结果页原本只认 localStorage。少了这条
 * 路径，账户页给出的就是一堆打不开的链接——用户清理了浏览器数据，恰好是本阶段
 * 要解决的那个场景（见实施计划 §1.3）。
 *
 * 同样抽成注入依赖的纯模块：边界行为（未登录不查、故障不抛、版本不符不认）
 * 才是要保证的东西，而这些在组件里测不到。
 */

import type { QuickResultPayload } from "./quick-results";

export interface CloudResultLookupDependencies {
  currentUserId(): Promise<string | null>;
  /** PromiseLike so a PostgREST query builder can be passed without wrapping it. */
  findOwn(ownerId: string, resultKey: string): PromiseLike<{ data: unknown; error: unknown }>;
}

/**
 * 取回一条云端结果，只接受与调用方当前题库版本一致的那一条。
 *
 * 版本这一关是必须的，不是保守：结果页的渲染依赖当前版本的维度与人格定义，
 * 用旧版本 payload 渲染会得到一份看起来正常、实际不成立的报告。宁可回到
 * 「本机没有这份结果」，与已有的版本守卫保持同一口径。
 */
export async function fetchOwnCloudQuickResult<TPayload extends QuickResultPayload = QuickResultPayload>(
  deps: CloudResultLookupDependencies,
  input: { resultKey: string; contentVersion: string }
): Promise<TPayload | null> {
  let ownerId: string | null;
  try {
    ownerId = await deps.currentUserId();
  } catch {
    return null;
  }
  if (!ownerId) return null;

  try {
    const { data, error } = await deps.findOwn(ownerId, input.resultKey);
    if (error || !Array.isArray(data)) return null;

    const row = data[0];
    if (typeof row !== "object" || row === null) return null;
    const storedRow = row as Record<string, unknown>;
    if (storedRow.content_version !== input.contentVersion) return null;
    const payload = storedRow.result_payload;
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;

    const record = payload as Record<string, unknown>;
    // payload 自带的版本要能独立核对：只信列而不看 payload，就会在两者不一致时
    // 渲染出一份版本对不上的报告。迁移里的 check 约束让这种行不该存在，
    // 但这里不能依赖那条约束已经生效。
    if (record.contentVersion !== input.contentVersion) return null;

    // 整个流程里唯一的类型断言点，且只此一处：这是从 jsonb 里读出来的 JSON，
    // 运行期形状由写入端与迁移约束保证，版本刚在上面核对过。把它变成调用方
    // 声明的类型，除此以外没有别的办法，而在这里断言至少是集中且可注释的。
    return record as unknown as TPayload;
  } catch {
    return null;
  }
}
