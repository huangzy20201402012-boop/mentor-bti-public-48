"use client";

export type FeedbackStatus = "idle" | "submitting" | "success" | "login_required" | "error";

export const FEEDBACK_UNAVAILABLE_MESSAGE = "提交没有成功，你可以稍后再试。";

/**
 * 提示文案与 Codex 交接报告 §4.2 保持一致，三个反馈入口复用同一份，避免
 * 各表单自行改写隐私口径。
 */
export function FeedbackPrivacyNote({ className }: { className?: string }) {
  return (
    <p className={className ? `feedback-privacy ${className}` : "feedback-privacy"}>
      为改善测试体验，我们仅收集必要的产品反馈；提交时需登录。请不要在反馈中填写导师姓名、学校、手机号等可识别个人的信息。
    </p>
  );
}

const SUCCESS_MESSAGE = "谢谢你的反馈，它会帮助我们继续校准导师BTI。";

export interface FeedbackStatusNoteProps {
  status: FeedbackStatus;
  errorMessage?: string;
}

/**
 * 提交状态区。使用 aria-live 让读屏用户在提交后听到结果，但不抢焦点——
 * 反馈永远不应该把用户从当前内容上拽走。
 */
export function FeedbackStatusNote({ status, errorMessage }: FeedbackStatusNoteProps) {
  if (status === "idle") return null;

  if (status === "login_required") {
    return (
      <p className="feedback-status is-error" role="alert" aria-live="assertive">
        提交反馈需要先登录。<a href="/account" target="_blank" rel="noopener noreferrer">登录或注册（新标签页）</a>后，回到这里再次提交。
      </p>
    );
  }

  const isError = status === "error";
  return (
    <p
      className={isError ? "feedback-status is-error" : "feedback-status"}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      {isError ? errorMessage ?? FEEDBACK_UNAVAILABLE_MESSAGE : status === "submitting" ? "正在提交…" : SUCCESS_MESSAGE}
    </p>
  );
}
