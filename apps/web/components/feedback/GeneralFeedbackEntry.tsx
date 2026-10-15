"use client";

import { useId, useState } from "react";
import { trackEvent } from "../../lib/analytics/client";
import { submitFeedbackWithReceipt } from "../../lib/feedback/client";
import type { FeedbackInput } from "../../lib/analytics/contracts";
import { Sheet } from "../ui/Sheet";
import { FeedbackContactOptIn } from "./FeedbackContactOptIn";
import { FeedbackPrivacyNote, FeedbackStatusNote, FEEDBACK_UNAVAILABLE_MESSAGE, type FeedbackStatus } from "./FeedbackNotice";
import { FeedbackOptionList } from "./FeedbackOptionList";
import type { ChipOption } from "./FeedbackChipGroup";

type GeneralFeedbackType = NonNullable<FeedbackInput["feedbackType"]>;

/**
 * 只保留服务端 feedbackType 白名单中、且不要求 questionId 的类型。
 * `question_unclear` 需要题目 ID 与原因码，只能从答题页入口提交，因此这里
 * 不提供——Footer 里也提示用户去对应题目反馈。
 */
const TYPE_OPTIONS: Array<ChipOption<GeneralFeedbackType>> = [
  { value: "result_inaccurate", label: "结果不准" },
  { value: "page_bug", label: "页面异常" },
  { value: "share_issue", label: "分享问题" },
  { value: "visual_issue", label: "图片显示问题" },
  { value: "suggestion", label: "功能建议" },
  { value: "other", label: "其他" }
];

const MESSAGE_LIMIT = 1000;

export function GeneralFeedbackEntry() {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<GeneralFeedbackType | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  // Only a real receipt unlocks the optional email block; a failed or
  // unavailable submit must never expose a contact field.
  const [feedbackId, setFeedbackId] = useState<number | null>(null);
  const fieldName = useId();

  const canSubmit = feedbackType !== null && message.trim().length > 0;

  function close(): void {
    setOpen(false);
    if (status !== "submitting") {
      setFeedbackType(null);
      setMessage("");
      setFeedbackId(null);
      setStatus("idle");
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!feedbackType || !canSubmit || status === "submitting") return;
    setStatus("submitting");
    const receipt = await submitFeedbackWithReceipt({
      feedbackType,
      message: message.trim(),
      pagePath: window.location.pathname
    });
    if (receipt.status === "submitted") {
      setFeedbackId(receipt.feedbackId);
      setStatus("success");
      trackEvent("general_feedback_submit");
      return;
    }
    setStatus(receipt.status === "login_required" ? "login_required" : "error");
  }

  return (
    <>
      <button className="text-button footer-feedback-trigger" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog">
        提交建议 / 报告问题
      </button>

      <Sheet
        open={open}
        title="提交建议 / 报告问题"
        description="提交反馈需要登录；没有账户可先注册。"
        onClose={close}
        footer={
          <div className="feedback-actions">
            {status === "success" ? (
              <button className="button button-primary" type="button" onClick={close}>关闭</button>
            ) : (
              <>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={!canSubmit || status === "submitting"}
                  onClick={() => void handleSubmit()}
                >
                  {status === "submitting" ? "正在提交…" : "提交"}
                </button>
                <button className="text-button" type="button" onClick={close} disabled={status === "submitting"}>
                  取消
                </button>
              </>
            )}
          </div>
        }
      >
        {status === "success" ? (
          <>
            <FeedbackStatusNote status="success" />
            {feedbackId !== null ? <FeedbackContactOptIn feedbackId={feedbackId} /> : null}
          </>
        ) : (
          <>
            <FeedbackOptionList<GeneralFeedbackType>
              name={`general-type-${fieldName}`}
              legend="属于哪一类"
              variant="wrap"
              options={TYPE_OPTIONS}
              value={feedbackType}
              disabled={status === "submitting"}
              onChange={setFeedbackType}
            />

            <div className="feedback-field">
              <label className="feedback-legend" htmlFor={`general-message-${fieldName}`}>
                具体说明
              </label>
              <textarea
                id={`general-message-${fieldName}`}
                className="feedback-textarea"
                rows={5}
                maxLength={MESSAGE_LIMIT}
                required
                value={message}
                disabled={status === "submitting"}
                placeholder="可以描述你遇到的问题或想要的功能。"
                onChange={(event) => setMessage(event.target.value)}
              />
              <p className="feedback-counter">{message.length} / {MESSAGE_LIMIT}</p>
            </div>

            <p className="feedback-note">
              如果是某一道题不好回答，请在该题的答题页使用「这题不好回答？」，这样我们能定位到具体题目。
            </p>

            <FeedbackStatusNote status={status} errorMessage={FEEDBACK_UNAVAILABLE_MESSAGE} />
            <FeedbackPrivacyNote />
          </>
        )}
      </Sheet>
    </>
  );
}
