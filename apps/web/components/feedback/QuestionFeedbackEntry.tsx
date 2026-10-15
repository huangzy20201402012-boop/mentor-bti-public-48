"use client";

import { useId, useState } from "react";
import { trackEvent } from "../../lib/analytics/client";
import { submitFeedback } from "../../lib/feedback/client";
import type { FeedbackInput } from "../../lib/analytics/contracts";
import { Sheet } from "../ui/Sheet";
import { FeedbackPrivacyNote, FeedbackStatusNote, FEEDBACK_UNAVAILABLE_MESSAGE, type FeedbackStatus } from "./FeedbackNotice";
import { FeedbackOptionList } from "./FeedbackOptionList";
import type { ChipOption } from "./FeedbackChipGroup";

type QuestionReason = NonNullable<FeedbackInput["reasonCode"]>;

const QUESTION_REASONS: Array<ChipOption<QuestionReason>> = [
  { value: "not_experienced", label: "没经历过这类情况" },
  { value: "unclear_wording", label: "题意不太清楚" },
  { value: "no_suitable_option", label: "没有合适的选项" },
  { value: "context_varies", label: "不同导师差异太大，没法一概而论" },
  { value: "other", label: "其他" }
];

const COMMENT_LIMIT = 1000;

export interface QuestionFeedbackEntryProps {
  questionId: string;
  questionIndex: number;
}

/**
 * 答题页的题目反馈入口。刻意放在题干的右上角、与底部的 N/A 答案按钮物理
 * 分开，避免被误认成一种作答方式；它不会调用 answer()，也不会推进题目。
 */
export function QuestionFeedbackEntry({ questionId, questionIndex }: QuestionFeedbackEntryProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<QuestionReason | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const fieldName = useId();

  function close(): void {
    setOpen(false);
    // 关闭后重置，下一次打开是干净的表单；但保留成功态直到关闭，
    // 让用户来得及看到「已收到」。
    if (status !== "submitting") {
      setReason(null);
      setComment("");
      setStatus("idle");
    }
  }

  async function handleSubmit(): Promise<void> {
    if (!reason || status === "submitting") return;
    setStatus("submitting");
    const outcome = await submitFeedback({
      feedbackType: "question_unclear",
      pagePath: "/quick/test",
      questionId,
      reasonCode: reason,
      message: comment.trim() ? comment.trim() : undefined
    });
    if (outcome === "submitted") {
      setStatus("success");
      trackEvent("question_feedback_submit", { questionId, questionIndex });
      return;
    }
    setStatus(outcome === "login_required" ? "login_required" : "error");
  }

  return (
    <>
      <button
        className="text-button question-feedback-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        这题不好回答？
      </button>

      <Sheet
        open={open}
        title="这题不好回答？"
        description="你的反馈会用于改进题目，不影响测试结果；提交需要登录。"
        onClose={close}
        footer={
          status === "success" ? (
            <div className="feedback-actions">
              <button className="button button-primary" type="button" onClick={close}>回到答题</button>
            </div>
          ) : (
            <div className="feedback-actions">
              <button
                className="button button-primary"
                type="button"
                disabled={!reason || status === "submitting"}
                onClick={() => void handleSubmit()}
              >
                {status === "submitting" ? "正在提交…" : "提交反馈"}
              </button>
              <button className="text-button" type="button" onClick={close} disabled={status === "submitting"}>
                先不反馈
              </button>
            </div>
          )
        }
      >
        {status === "success" ? (
          <FeedbackStatusNote status="success" />
        ) : (
          <>
            <FeedbackOptionList<QuestionReason>
              name={`question-reason-${fieldName}`}
              legend="主要卡在哪里"
              options={QUESTION_REASONS}
              value={reason}
              disabled={status === "submitting"}
              onChange={setReason}
            />

            <div className="feedback-field">
              <label className="feedback-legend" htmlFor={`question-comment-${fieldName}`}>
                想补充什么
                <span className="feedback-optional">选填</span>
              </label>
              <textarea
                id={`question-comment-${fieldName}`}
                className="feedback-textarea"
                rows={3}
                maxLength={COMMENT_LIMIT}
                value={comment}
                disabled={status === "submitting"}
                placeholder="可以写一下你觉得哪里不好选，但请不要写导师姓名或学校。"
                onChange={(event) => setComment(event.target.value)}
              />
            </div>

            <p className="feedback-note">
              如果你只是现在不方便判断，可以直接在答题页选择「无法判断 / 不适用」，不需要在这里反馈。
            </p>

            <FeedbackStatusNote status={status} errorMessage={FEEDBACK_UNAVAILABLE_MESSAGE} />
            <FeedbackPrivacyNote />
          </>
        )}
      </Sheet>
    </>
  );
}
