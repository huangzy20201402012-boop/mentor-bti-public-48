"use client";

import { useId, useState } from "react";
import { PRIVACY_VERSION } from "../../lib/analytics/version";
import { submitFeedbackContact } from "../../lib/feedback/client";

type ContactStatus = "idle" | "submitting" | "success" | "login_required" | "error";

/**
 * 反馈提交成功之后才出现的可选联系方式。
 *
 * 三条硬约束：只在拿到 feedbackId 后渲染（邮箱永远不出现在反馈提交之前）、
 * 邮箱与许可复选框都默认空 / 未勾选、两个条件同时满足才允许提交。不填直接
 * 关闭是正常路径，不是错误路径。
 */
export function FeedbackContactOptIn({ feedbackId }: { feedbackId: number }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<ContactStatus>("idle");
  const fieldId = useId();

  const canSubmit = email.trim().length > 0 && agreed && status !== "submitting";

  async function handleSubmit(): Promise<void> {
    if (!canSubmit) return;
    setStatus("submitting");
    const outcome = await submitFeedbackContact({ feedbackId, email: email.trim(), privacyVersion: PRIVACY_VERSION });
    setStatus(outcome === "submitted" ? "success" : outcome === "login_required" ? "login_required" : "error");
  }

  if (status === "success") {
    return (
      <div className="contact-optin" role="status">
        <p className="contact-optin-thanks">已记下你的邮箱。如果这次内测有合适的位置，我们会通过它联系你。</p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="contact-optin">
        <p className="contact-optin-prompt">愿意参加后续访谈或内测吗？</p>
        <button className="text-button contact-optin-trigger" type="button" onClick={() => setOpen(true)}>
          留下邮箱（选填）
        </button>
      </div>
    );
  }

  return (
    <div className="contact-optin">
      <label className="feedback-legend" htmlFor={`contact-email-${fieldId}`}>
        邮箱
        <span className="feedback-optional">选填</span>
      </label>
      <input
        id={`contact-email-${fieldId}`}
        className="feedback-input"
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
        value={email}
        disabled={status === "submitting"}
        placeholder="name@example.com"
        onChange={(event) => setEmail(event.target.value)}
      />
      <p className="contact-optin-note">仅用于后续产品访谈或测试邀请，不会用于其他用途。</p>

      <label className="consent-choice contact-optin-consent">
        <input
          type="checkbox"
          checked={agreed}
          disabled={status === "submitting"}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span className="consent-choice-text">我愿意接受后续访谈或测试邀请</span>
      </label>

      <div className="feedback-actions">
        <button className="button button-primary" type="button" disabled={!canSubmit} onClick={() => void handleSubmit()}>
          {status === "submitting" ? "正在提交…" : "提交邮箱"}
        </button>
        <button className="text-button" type="button" disabled={status === "submitting"} onClick={() => setOpen(false)}>
          不用了
        </button>
      </div>

      {status === "error" ? (
        <p className="feedback-status is-error" role="alert">邮箱没有提交成功，你可以稍后再试；这不影响你已经提交的反馈。</p>
      ) : null}
      {status === "login_required" ? (
        <p className="feedback-status is-error" role="alert">登录状态已失效。请<a href="/account" target="_blank" rel="noopener noreferrer">重新登录（新标签页）</a>后再提交邮箱；你已经提交的反馈不受影响。</p>
      ) : null}
    </div>
  );
}
