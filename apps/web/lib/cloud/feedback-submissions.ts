/**
 * 登录用户的反馈提交。
 *
 * 与 V1.1 的匿名反馈是两回事：那张表服务于未登录的运营采集，这张表要求登录，
 * 目的是减少匿名滥用并让用户能回看自己的提交。同样抽成注入依赖的纯模块。
 */

export const FEEDBACK_CATEGORIES = ["bug", "suggestion", "content", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];
export const FEEDBACK_MESSAGE_MAX_LENGTH = 4000;

export type FeedbackValidationError = "category" | "message_empty" | "message_too_long";
export type FeedbackValidation =
  | { ok: true; value: { category: FeedbackCategory; message: string } }
  | { ok: false; reason: FeedbackValidationError };

function isFeedbackCategory(value: string): value is FeedbackCategory {
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

export function validateFeedbackSubmission(input: { category: string; message: string }): FeedbackValidation {
  if (!isFeedbackCategory(input.category)) return { ok: false, reason: "category" };

  const message = input.message.trim();
  if (message.length === 0) return { ok: false, reason: "message_empty" };
  // 长度按裁剪后计算，并与数据库的 char_length 约束一致；两处都拦是为了让
  // 超长输入在本地就得到提示，而不是变成一次 400。
  if (message.length > FEEDBACK_MESSAGE_MAX_LENGTH) return { ok: false, reason: "message_too_long" };

  return { ok: true, value: { category: input.category, message } };
}

export interface FeedbackSubmissionRow {
  owner_id: string;
  category: FeedbackCategory;
  message: string;
}

export type FeedbackSubmitOutcome = "saved" | "invalid" | "skipped" | "failed";

export interface FeedbackSubmissionDependencies {
  isSignedIn(): Promise<boolean>;
  /** PromiseLike so a PostgREST query builder can be passed without wrapping it. */
  insert(row: FeedbackSubmissionRow): PromiseLike<{ error: unknown }>;
  onError?(error: unknown): void;
}

export interface FeedbackSubmitInput {
  ownerId: string;
  category: string;
  message: string;
}

/**
 * 提交反馈。校验先于任何网络动作——非法输入不读登录态、不发请求。
 * 与云端保存结果一样，任何故障都收敛成返回值，不抛给界面。
 */
export async function submitFeedbackToCloud(
  deps: FeedbackSubmissionDependencies,
  input: FeedbackSubmitInput
): Promise<FeedbackSubmitOutcome> {
  const validation = validateFeedbackSubmission(input);
  if (!validation.ok) return "invalid";

  let signedIn: boolean;
  try {
    signedIn = await deps.isSignedIn();
  } catch {
    return "skipped";
  }
  if (!signedIn) return "skipped";

  // 只拼这三个字段：反馈里不出现邮箱、导师、学校、课题组，也不附加任何答题内容。
  const row: FeedbackSubmissionRow = {
    owner_id: input.ownerId,
    category: validation.value.category,
    message: validation.value.message
  };

  try {
    const { error } = await deps.insert(row);
    if (error) deps.onError?.(error);
    return error ? "failed" : "saved";
  } catch (error) {
    deps.onError?.(error);
    return "failed";
  }
}
