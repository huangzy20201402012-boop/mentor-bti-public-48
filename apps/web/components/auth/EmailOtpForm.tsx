"use client";

import { useEffect, useState } from "react";
import { requestEmailOtp, type RequestOtpStatus } from "../../lib/auth/actions";
import { normalizeEmail } from "../../lib/auth/email-otp";
import { resendLabel, secondsUntilResend } from "../../lib/auth/resend-cooldown";

const REQUEST_MESSAGES: Record<Exclude<RequestOtpStatus, "sent">, string> = {
  invalid_email: "请输入一个可收信的邮箱地址。",
  unavailable: "邮箱登录暂时不可用，你仍然可以直接做 48 题测试。",
  failed: "登录邮件没能发出去，请稍后再试。"
};

const ERROR_ID = "auth-error";

/** Email-link sign-in until branded OTP emails are available. */
export function EmailOtpForm() {
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(0);

  const secondsLeft = secondsUntilResend(sentAt, nowMs);

  useEffect(() => {
    if (sentAt === null) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);
      if (secondsUntilResend(sentAt, now) === 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sentAt]);

  async function sendLink(normalizedEmail: string): Promise<void> {
    if (pending || secondsUntilResend(sentAt, Date.now()) > 0) return;

    setPending(true);
    setError(null);
    try {
      const status = await requestEmailOtp(normalizedEmail, window.location.origin);
      if (status === "sent") {
        const now = Date.now();
        setSentAt(now);
        setNowMs(now);
        setSentEmail(normalizedEmail);
        return;
      }
      setError(REQUEST_MESSAGES[status]);
    } catch {
      setError(REQUEST_MESSAGES.failed);
    } finally {
      setPending(false);
    }
  }

  async function submitEmail(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const normalized = normalizeEmail(email);
    if (!normalized) { setError(REQUEST_MESSAGES.invalid_email); return; }
    setEmail(normalized);
    await sendLink(normalized);
  }

  if (sentEmail) {
    return (
      <section className="auth-form" aria-live="polite">
        <h2>查看登录邮件</h2>
        <p className="auth-hint">如果 {sentEmail} 对应已有账户且能够收信，登录链接会送到该邮箱。请在打开本站的同一浏览器中点击链接，或把链接粘贴到该浏览器。</p>
        <p className="auth-hint">没有收到？请查看垃圾邮件，或稍后重新发送。链接过期后也可以重新获取。</p>
        {error && <p className="auth-error" id={ERROR_ID} role="alert">{error}</p>}
        <div className="auth-actions">
          <button className="text-button" type="button" disabled={pending || secondsLeft > 0} onClick={() => void sendLink(sentEmail)}>
            {pending ? "正在发送…" : secondsLeft > 0 ? resendLabel(secondsLeft) : "重新发送邮件"}
          </button>
          <button className="text-button" type="button" disabled={pending} onClick={() => { setSentEmail(null); setError(null); }}>
            ← 换一个邮箱
          </button>
        </div>
      </section>
    );
  }

  return (
    <form className="auth-form" onSubmit={submitEmail} noValidate>
      <h2>登录你的账户</h2>
      <p className="auth-hint">输入邮箱后，点击邮件中的确认链接即可登录，无需设置密码。登录后，新完成的 48 题结果会保存到你的账户。</p>
      <label htmlFor="auth-email">邮箱</label>
      <input
        id="auth-email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={pending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? ERROR_ID : undefined}
        required
      />
      {error && <p className="auth-error" id={ERROR_ID} role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={pending || secondsLeft > 0}>
        {pending ? "正在发送…" : secondsLeft > 0 ? resendLabel(secondsLeft) : "发送登录邮件"}
      </button>
    </form>
  );
}
