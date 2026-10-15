"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "../../lib/analytics/client";
import { QUICK_QUESTIONNAIRE_VERSION, QUICK_SCORING_VERSION } from "../../lib/analytics/version";
import { submitResultFeedback } from "../../lib/feedback/client";
import { getQuickRun, type QuickRunContext } from "../../lib/quick-run-store";
import type { ResultFeedbackInput } from "../../lib/analytics/contracts";
import { FeedbackChipGroup, type ChipOption } from "./FeedbackChipGroup";
import { FeedbackPrivacyNote, FeedbackStatusNote, FEEDBACK_UNAVAILABLE_MESSAGE, type FeedbackStatus } from "./FeedbackNotice";
import { FeedbackScale } from "./FeedbackScale";

type ReasonTag = ResultFeedbackInput["reasonTags"][number];

const SCALE_OPTIONS = [
  { value: 1, label: "完全不像" },
  { value: 2, label: "不太像" },
  { value: 3, label: "一般" },
  { value: 4, label: "比较像" },
  { value: 5, label: "非常像" }
];

/**
 * 结果页认可度反馈。只做「像不像」，不下诊断结论。
 *
 * 分档展示原因标签：认可度 4–5 分时展示正向词汇，1–3 分时展示偏差词汇。
 * 两档都来自服务端契约里固定的 reasonTags 枚举，前端不自造标签；切换分数
 * 档位时会丢弃当前档位不再存在的标签，避免提交出互相矛盾的原因。
 */
const POSITIVE_REASONS: Array<ChipOption<ReasonTag>> = [
  { value: "type_matches", label: "类型很像" },
  { value: "description_matches", label: "描述很像" },
  { value: "axis_matches", label: "四轴符合实际" },
  { value: "details_resonate", label: "有些细节说中了" },
  { value: "other", label: "其他" }
];

const NEGATIVE_REASONS: Array<ChipOption<ReasonTag>> = [
  { value: "type_mismatch", label: "类型不太像" },
  { value: "axis_mismatch", label: "四轴有偏差" },
  { value: "description_mismatch", label: "描述不符合" },
  { value: "questions_hard_to_answer", label: "题目不好判断" },
  { value: "advisor_changes_by_context", label: "导师不同情境差别很大" },
  { value: "not_enough_interaction", label: "和导师相处时间还不够" },
  { value: "other", label: "其他" }
];

const COMMENT_LIMIT = 1000;

export interface ResultFeedbackFormProps {
  resultKey: string;
  typeCode: string;
  domainCode: string;
}

export function ResultFeedbackForm({ resultKey, typeCode, domainCode }: ResultFeedbackFormProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [reasons, setReasons] = useState<ReasonTag[]>([]);
  const [comment, setComment] = useState("");
  const [commentOpen, setCommentOpen] = useState(false);
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [run, setRun] = useState<QuickRunContext | null>(null);
  const openedRef = useRef(false);

  // 结果页是静态渲染的，只能挂载后再读本次访问创建过的 run。
  // 读不到就是「没有远端 run」，反馈照常提交，只是少两个可选字段。
  useEffect(() => { setRun(getQuickRun(resultKey)); }, [resultKey]);

  const domain = domainCode as "ED" | "EN" | "MD" | "MN";
  const availableReasons = useMemo(
    () => (rating !== null && rating >= 4 ? POSITIVE_REASONS : NEGATIVE_REASONS),
    [rating]
  );

  // 反馈区块可见不等于用户在反馈；以第一次真实交互作为「打开」口径，
  // 这样 result_feedback_open → result_feedback_submit 才是有效的转化率。
  function markOpened(): void {
    if (openedRef.current) return;
    openedRef.current = true;
    trackEvent("result_feedback_open", { typeCode, domainCode: domain });
  }

  function handleRatingChange(next: number): void {
    markOpened();
    setRating(next);
    const allowed = next >= 4 ? POSITIVE_REASONS : NEGATIVE_REASONS;
    setReasons((current) => current.filter((tag) => allowed.some((option) => option.value === tag)));
  }

  function handleReasonToggle(tag: ReasonTag): void {
    markOpened();
    setReasons((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  }

  async function handleSubmit(): Promise<void> {
    if (rating === null || status === "submitting") return;
    markOpened();
    setStatus("submitting");
    const outcome = await submitResultFeedback({
      resultKey,
      typeCode,
      domainCode: domain,
      accuracyRating: rating,
      reasonTags: reasons,
      comment: comment.trim() ? comment.trim() : undefined,
      testRunId: run?.testRunId,
      questionnaireVersion: run ? QUICK_QUESTIONNAIRE_VERSION : undefined,
      scoringVersion: run ? QUICK_SCORING_VERSION : undefined
    });
    if (outcome === "submitted") {
      setStatus("success");
      trackEvent("result_feedback_submit", { typeCode, domainCode: domain });
      return;
    }
    setStatus(outcome === "login_required" ? "login_required" : "error");
  }

  if (status === "success") {
    return (
      <section className="feedback-panel result-feedback" aria-labelledby="result-feedback-heading">
        <h2 className="feedback-title" id="result-feedback-heading">这个结果像你的导师吗？</h2>
        <FeedbackStatusNote status="success" />
      </section>
    );
  }

  return (
    <section className="feedback-panel result-feedback" aria-labelledby="result-feedback-heading">
      <h2 className="feedback-title" id="result-feedback-heading">这个结果像你的导师吗？</h2>
      <p className="feedback-subtitle">你的评分只用于校准测试，不会公开，也不会告诉任何人你评了谁。</p>
      <p className="feedback-note">提交这条反馈需要登录；没有账户可先注册。</p>

      <FeedbackScale
        name="result-accuracy"
        legend="像的程度"
        value={rating}
        options={SCALE_OPTIONS}
        disabled={status === "submitting"}
        onChange={handleRatingChange}
      />

      {rating !== null ? (
        <FeedbackChipGroup
          legend={rating >= 4 ? "像在哪里" : "哪里不像"}
          options={availableReasons}
          selected={reasons}
          disabled={status === "submitting"}
          onToggle={handleReasonToggle}
        />
      ) : null}

      {commentOpen ? (
        <div className="feedback-field">
          <label className="feedback-legend" htmlFor="result-feedback-comment">
            想补充什么
            <span className="feedback-optional">选填</span>
          </label>
          <textarea
            id="result-feedback-comment"
            className="feedback-textarea"
            rows={3}
            maxLength={COMMENT_LIMIT}
            value={comment}
            disabled={status === "submitting"}
            placeholder="可以写具体是哪一点像、哪一点不像，但请不要写导师姓名或学校。"
            onChange={(event) => setComment(event.target.value)}
            onFocus={markOpened}
          />
          <p className="feedback-counter">{comment.length} / {COMMENT_LIMIT}</p>
        </div>
      ) : (
        <button
          className="text-button feedback-more"
          type="button"
          onClick={() => { markOpened(); setCommentOpen(true); }}
        >
          补充说明（选填）
        </button>
      )}

      <div className="feedback-actions">
        <button
          className="button button-primary"
          type="button"
          disabled={rating === null || status === "submitting"}
          onClick={() => void handleSubmit()}
        >
          {status === "submitting" ? "正在提交…" : "提交反馈"}
        </button>
      </div>

      <FeedbackStatusNote status={status} errorMessage={FEEDBACK_UNAVAILABLE_MESSAGE} />
      <FeedbackPrivacyNote />
    </section>
  );
}
