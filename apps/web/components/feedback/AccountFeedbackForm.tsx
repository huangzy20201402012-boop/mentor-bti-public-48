"use client";

import { useState } from "react";
import { FEEDBACK_CATEGORIES, FEEDBACK_MESSAGE_MAX_LENGTH, validateFeedbackSubmission, type FeedbackCategory } from "../../lib/cloud/feedback-submissions";
import { submitAccountFeedback } from "../../lib/cloud/client";
import { FeedbackPrivacyNote } from "./FeedbackNotice";

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: "功能异常",
  suggestion: "产品建议",
  content: "题目或结果内容",
  other: "其他"
};

const OUTCOME_MESSAGES: Record<"invalid" | "skipped" | "failed", string> = {
  invalid: "请先填写反馈内容。",
  // 走到这里说明提交时登录态已经失效，通常是在另一个标签页退出了登录。
  skipped: "登录状态已失效，请重新登录后再提交。",
  failed: "提交没有成功，你可以稍后再试。"
};

/**
 * 账户反馈表单。
 *
 * 与 V1.1 的三个匿名反馈入口是两套东西：那张表服务于未登录的运营采集，
 * 这一份要求登录。同样是「只提交用户自己写下的文字」——表单只发送分类与正文，
 * 不附加任何答题内容、题目、结果或页面路径。
 */
export function AccountFeedbackForm() {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<"sent" | "invalid" | "skipped" | "failed" | null>(null);
  const [failureCode, setFailureCode] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    // 先在本地校验：空反馈不该占用一次往返，超长也不该变成一次服务端拒绝。
    const validation = validateFeedbackSubmission({ category, message });
    if (!validation.ok) { setOutcome("invalid"); return; }

    setPending(true);
    setOutcome(null);
    setFailureCode(null);
    try {
      const { status, errorCode } = await submitAccountFeedback(validation.value);
      if (status === "saved") { setOutcome("sent"); setMessage(""); return; }
      setFailureCode(errorCode);
      setOutcome(status);
    } catch {
      setOutcome("failed");
    } finally {
      setPending(false);
    }
  }

  const sent = outcome === "sent";
  const errorMessage = outcome && outcome !== "sent" ? OUTCOME_MESSAGES[outcome] : null;

  return (
    <form className="feedback-form" onSubmit={submit} noValidate>
      <fieldset disabled={pending}>
        <legend>反馈类型</legend>
        <div className="feedback-category-row">
          {FEEDBACK_CATEGORIES.map((value) => (
            <label key={value} className={category === value ? "feedback-category is-selected" : "feedback-category"}>
              <input
                type="radio"
                name="category"
                value={value}
                checked={category === value}
                onChange={() => setCategory(value)}
              />
              <span>{CATEGORY_LABELS[value]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor="feedback-message">反馈内容</label>
      <textarea
        id="feedback-message"
        name="message"
        rows={6}
        maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        disabled={pending}
        aria-describedby="feedback-message-count"
        required
      />
      <p id="feedback-message-count" className="feedback-count">
        {message.trim().length} / {FEEDBACK_MESSAGE_MAX_LENGTH}
      </p>

      <FeedbackPrivacyNote />

      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "正在提交…" : "提交反馈"}
      </button>

      {/* 提交结果用 aria-live 播报，但不移动焦点——提交反馈不该把用户从表单上拽走。 */}
      {sent ? <p className="feedback-status" role="status" aria-live="polite">谢谢你的反馈，我们会尽快查看。</p> : null}
      {errorMessage ? (
        <p className="feedback-status is-error" role="alert" aria-live="assertive">
          {errorMessage}{outcome === "skipped" ? <> <a href="/account" target="_blank" rel="noopener noreferrer">登录或注册（新标签页）</a></> : null}
          {failureCode ? `（错误代码：${failureCode}）` : ""}
        </p>
      ) : null}
    </form>
  );
}
