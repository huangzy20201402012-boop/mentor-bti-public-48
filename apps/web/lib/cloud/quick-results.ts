/**
 * 48 题结果的云端写入。
 *
 * 抽成不依赖 React 与 Supabase SDK 的纯模块，理由与 quick-run-session 相同：
 * 真正需要保证的行为（未登录不写、写入失败不抛错、原始作答不外泄）都发生在
 * 网络边界上，而本仓库没有 jsdom / React Testing Library，组件里测不到。
 * 依赖由调用方注入，测试用假实现驱动。
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export interface CloudCryptoSource {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

export interface CloudIdOptions {
  cryptoSource?: CloudCryptoSource | null;
}

/**
 * 生成一个 v4 UUID。
 *
 * 不能只用 `crypto.randomUUID`：局域网 HTTP 下部分手机会缺少它（client-session-id
 * 就是为同样的原因做的兜底）。没有随机源时退回 Math.random——这个 ID 只是数据库
 * 主键，冲突由唯一约束兜住，不承担安全职责。
 */
export function createCloudResultId(options?: CloudIdOptions): string {
  const source: CloudCryptoSource | null =
    options?.cryptoSource === undefined ? (globalThis.crypto ?? null) : options.cryptoSource;

  if (typeof source?.randomUUID === "function") {
    try { return source.randomUUID(); } catch { /* 非安全上下文会抛，继续走下面的兜底 */ }
  }

  const bytes = new Uint8Array(16);
  let filled = false;
  if (typeof source?.getRandomValues === "function") {
    try { source.getRandomValues(bytes); filled = true; } catch { filled = false; }
  }
  if (!filled) {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * 本地结果键是 UUID 时原样沿用，否则另生成一个。
 *
 * 本地的 result key 在安全上下文下就是 UUID，但在局域网 HTTP 下会退化成
 * `quick-<base36>`，无法直接作为 uuid 主键。因此云端行始终另存一份 result_key，
 * 让结果路由可以按本地键查回自己那条记录。
 */
export function resolveCloudResultId(resultKey: string, options?: CloudIdOptions): string {
  return isUuid(resultKey) ? resultKey : createCloudResultId(options);
}

/**
 * 只有派生分数，没有作答过程。
 *
 * 刻意不写成索引签名类型：`QuickResult` 这类具名接口没有索引签名，用了反而
 * 会把它挡在门外（TS 的索引签名不是「任意额外字段」的意思）。写入端只要求
 * 「能自证版本」，其余字段原样随 payload 进 jsonb。
 */
export interface QuickResultPayload {
  contentVersion: string;
}

export interface QuickResultRow<TPayload extends QuickResultPayload = QuickResultPayload> {
  id: string;
  result_key: string;
  owner_id: string;
  content_version: string;
  result_payload: TPayload;
}

/**
 * 逐字段拼行，而不是展开传入对象。
 *
 * 这一点是刻意的：网络层只可能拿到这里列出的字段，作答过程即使被误传进来也
 * 不会被写库。「不上传原始作答」由这个函数的结构保证，而不是靠调用方自觉。
 */
export function buildQuickResultRow<TPayload extends QuickResultPayload>(input: {
  resultKey: string;
  ownerId: string;
  result: TPayload;
  cloudId?: string;
}): QuickResultRow<TPayload> {
  return {
    id: input.cloudId ?? resolveCloudResultId(input.resultKey),
    result_key: input.resultKey,
    owner_id: input.ownerId,
    content_version: input.result.contentVersion,
    result_payload: input.result
  };
}

export type CloudSaveOutcome = "saved" | "skipped" | "failed";

export interface QuickResultSaverDependencies {
  isSignedIn(): Promise<boolean>;
  /** PromiseLike so a PostgREST query builder can be passed without wrapping it. */
  insert(row: QuickResultRow): PromiseLike<{ error: unknown }>;
}

export interface QuickResultSaveInput {
  resultKey: string;
  ownerId: string;
  result: QuickResultPayload;
  cloudId?: string;
}

/**
 * 云端保存绝不抛错，也绝不阻断结果页——本地结果才是用户当下要看的东西。
 * 返回值只用于决定是否显示一句非阻断的提示。
 */
export function createQuickResultSaver(deps: QuickResultSaverDependencies) {
  return async function saveQuickResult(input: QuickResultSaveInput): Promise<CloudSaveOutcome> {
    let signedIn: boolean;
    try {
      signedIn = await deps.isSignedIn();
    } catch {
      return "skipped";
    }
    if (!signedIn) return "skipped";

    try {
      const { error } = await deps.insert(buildQuickResultRow(input));
      return error ? "failed" : "saved";
    } catch {
      return "failed";
    }
  };
}
