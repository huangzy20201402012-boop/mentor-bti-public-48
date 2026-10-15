"use client";

import { useState } from "react";
import { setAccountPassword, type SetPasswordStatus } from "../../lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "../../lib/auth/password-policy";

const ERROR_ID = "set-password-error";

const MESSAGES: Record<Exclude<SetPasswordStatus, "updated">, string> = {
  signed_out: "登录已失效，请重新登录后再设置密码。",
  too_short: `密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符。`,
  mismatch: "两次输入的密码不一致。",
  weak_password: "这个密码未通过安全检查，请换一个更强的密码。",
  weak_password_length: "密码长度未达到当前账户的安全要求，请使用更长的密码。",
  weak_password_characters: "密码字符种类不足，请加入大小写字母、数字或符号。",
  weak_password_pwned: "这个密码出现在已知泄露记录中，请换一个全新的密码。",
  same_password: "新密码不能与当前密码相同，请换一个。",
  reauth_required: "请重新登录后再设置密码。",
  unavailable: "账户服务暂时不可用，请稍后再试。",
  failed: "密码没有保存成功。如果再次尝试仍失败，请在反馈页告诉我们。"
};

export function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setSuccess(false);
    try {
      const status = await setAccountPassword(password, confirmation);
      if (status === "updated") {
        setPassword("");
        setConfirmation("");
        setSuccess(true);
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
    <form className="auth-form" onSubmit={submit} noValidate>
      <h2>设置或修改登录密码</h2>
      <p className="auth-hint">如果你刚用邮箱密码注册或登录，无需再次填写。需要补设或更换密码时，请输入至少 {MIN_PASSWORD_LENGTH} 个字符的新密码。</p>
      <label htmlFor="account-new-password">新密码</label>
      <input
        id="account-new-password"
        name="new-password"
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
      <label htmlFor="account-confirm-password">再次输入密码</label>
      <input
        id="account-confirm-password"
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
      {success && <p className="auth-hint" role="status">密码已设置成功。下次可以直接用邮箱和密码登录。</p>}
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "正在保存…" : "保存密码"}
      </button>
    </form>
  );
}
