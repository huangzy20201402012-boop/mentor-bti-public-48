"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPassword, type PasswordSignInStatus } from "../../lib/auth/actions";
import { normalizeEmail } from "../../lib/auth/email-otp";
import { PasswordSignUpForm } from "./PasswordSignUpForm";

const MESSAGES: Record<Exclude<PasswordSignInStatus, "signed_in">, string> = {
  invalid_credentials: "邮箱或密码不正确。请核对后重试；没有账户可先注册。",
  rate_limited: "登录尝试太频繁了，请稍后再试。",
  unavailable: "账户登录暂时不可用，请稍后再试。",
  failed: "登录没有成功，请稍后再试。"
};

export function PasswordLoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const normalized = normalizeEmail(email);
    if (!normalized || !password) {
      setError("请输入邮箱和密码。");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const status = await signInWithPassword(normalized, password);
      if (status === "signed_in") {
        setPassword("");
        router.refresh();
        return;
      }
      setError(MESSAGES[status]);
    } catch {
      setError(MESSAGES.failed);
    } finally {
      setPending(false);
    }
  }

  if (mode === "signup") {
    return <PasswordSignUpForm onBack={() => setMode("login")} />;
  }

  return (
    <>
    <form className="auth-form" onSubmit={submit} noValidate>
      <h2>邮箱密码登录</h2>
      <p className="auth-hint">输入账户邮箱和密码；第一次使用可注册新账户。</p>
      <label htmlFor="password-login-email">邮箱</label>
      <input
        id="password-login-email"
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
        aria-describedby={error ? "password-login-error" : undefined}
        required
      />
      <label htmlFor="password-login-password">密码</label>
      <input
        id="password-login-password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        disabled={pending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "password-login-error" : undefined}
        required
      />
      {error && <p className="auth-error" id="password-login-error" role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "正在登录…" : "登录"}
      </button>
    </form>
    <div className="auth-login-actions">
      <button className="text-button" type="button" onClick={() => setMode("signup")}>
        没有账户？注册新账户
      </button>
    </div>
    </>
  );
}
