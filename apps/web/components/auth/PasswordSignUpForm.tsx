"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUpWithPassword, type PasswordSignUpStatus } from "../../lib/auth/actions";
import { normalizeEmail } from "../../lib/auth/email-otp";
import { MIN_PASSWORD_LENGTH } from "../../lib/auth/password-policy";

const ERROR_ID = "password-signup-error";

const MESSAGES: Record<Exclude<PasswordSignUpStatus, "signed_in" | "signed_in_password_setup_needed">, string> = {
  confirmation_required: "当前账户服务仍要求邮件确认，暂时无法完成免邮件注册。请联系管理员调整设置后再试。",
  account_exists: "该邮箱已有账户，或无法再次创建。请尝试登录；如果忘记密码，请联系管理员。",
  invalid_email: "请输入有效的邮箱地址。",
  too_short: `密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符。`,
  mismatch: "两次输入的密码不一致。",
  weak_password: "这个密码未通过安全检查，请换一个更强的密码。",
  weak_password_length: "密码长度未达到当前账户的安全要求，请使用更长的密码。",
  weak_password_characters: "密码字符种类不足，请加入大小写字母、数字或符号。",
  weak_password_pwned: "这个密码出现在已知泄露记录中，请换一个全新的密码。",
  signup_disabled: "账户注册尚未开放，请稍后再试。",
  rate_limited: "注册请求太频繁，请稍后再试。",
  unavailable: "账户服务暂时不可用，请稍后再试。",
  failed: "注册没有完成。请稍后重试；如果仍然失败，请联系项目管理员。"
};

export function PasswordSignUpForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const normalized = normalizeEmail(email);
    if (!normalized) { setError(MESSAGES.invalid_email); return; }
    if (password !== confirmation) { setError(MESSAGES.mismatch); return; }
    if (password.length < MIN_PASSWORD_LENGTH) { setError(MESSAGES.too_short); return; }

    setPending(true);
    setError(null);
    try {
      const status = await signUpWithPassword(normalized, password, confirmation);
      if (status === "signed_in") {
        setPassword("");
        setConfirmation("");
        window.dispatchEvent(new Event("mentor-bti:stats-changed"));
        router.refresh();
        return;
      }
      if (status === "signed_in_password_setup_needed") {
        setPassword("");
        setConfirmation("");
        window.dispatchEvent(new Event("mentor-bti:stats-changed"));
        router.push("/account?password_setup=required");
        return;
      }
      setError(MESSAGES[status]);
    } catch {
      setError(MESSAGES.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form className="auth-form" onSubmit={submit} noValidate>
        <h2>注册新账户</h2>
        <p className="auth-hint">用邮箱和密码创建账户。注册成功后直接登录，无需接收邮件验证码。</p>
        <label htmlFor="password-signup-email">邮箱</label>
        <input
          id="password-signup-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ERROR_ID : undefined}
          required
        />
        <label htmlFor="password-signup-password">密码</label>
        <input
          id="password-signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ERROR_ID : undefined}
          required
        />
        <p className="auth-hint">至少 {MIN_PASSWORD_LENGTH} 个字符。</p>
        <label htmlFor="password-signup-confirmation">再次输入密码</label>
        <input
          id="password-signup-confirmation"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ERROR_ID : undefined}
          required
        />
        {error && <p className="auth-error" id={ERROR_ID} role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending ? "正在注册…" : "注册账户"}
        </button>
      </form>
      <button className="text-button" type="button" onClick={onBack}>已有账户？返回登录</button>
    </>
  );
}
