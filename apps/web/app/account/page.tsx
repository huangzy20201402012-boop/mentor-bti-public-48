import type { Metadata } from "next";
import Link from "next/link";
import { AccountResults } from "../../components/AccountResults";
import { PasswordLoginForm } from "../../components/auth/PasswordLoginForm";
import { SessionGateRefresh } from "../../components/auth/SessionGateRefresh";
import { SetPasswordForm } from "../../components/auth/SetPasswordForm";
import { signOut } from "../../lib/auth/actions";
import { getAuthUser } from "../../lib/supabase/auth-server";

export const metadata: Metadata = {
  title: "我的账户｜导师BTI",
  robots: { index: false, follow: false }
};

// 登录态来自 cookie，静态化会把某个人的页面烤给所有人。
export const dynamic = "force-dynamic";

/**
 * 账户页。
 *
 * 只显示这一件事：当前登录状态、退出入口，以及这个用户自己的 48 题结果。
 * 不显示全站用户或反馈管理——反馈的
 * 处理在 Supabase Dashboard，不进入浏览器代码（实施计划 §5、§6.8）。
 */
export default async function AccountPage({
  searchParams
}: {
  searchParams: Promise<{ auth_error?: string; password_setup?: string }>;
}) {
  const { auth_error, password_setup } = await searchParams;
  const user = await getAuthUser();

  return (
    <main className="statement site-shell account-page">
      <p className="eyebrow">导师BTI</p>
      <h1>我的账户</h1>

      {user ? (
        <>
          <p className="account-identity">
            已登录：<strong>{user.email ?? "（邮箱不可用）"}</strong>
          </p>
          {password_setup === "required" && (
            <p className="auth-error" role="alert">账户已登录，但刚才的密码未能保存。请先在下方设置登录密码，再退出账户。</p>
          )}
          <form action={signOut}>
            <button className="text-button" type="submit">退出登录</button>
          </form>

          {password_setup === "required" ? (
            <SetPasswordForm />
          ) : (
            <details className="account-password-option">
              <summary>修改登录密码（可选）</summary>
              <SetPasswordForm />
            </details>
          )}

          <section className="account-section" aria-labelledby="account-results-heading">
            <h2 id="account-results-heading">我的 48 题结果</h2>
            <AccountResults />
          </section>

          <section className="account-section" aria-labelledby="account-feedback-heading">
            <h2 id="account-feedback-heading">反馈</h2>
            <p>遇到问题或有建议，可以在反馈页告诉我们。</p>
            <Link className="text-button" href="/feedback">前往反馈</Link>
          </section>
        </>
      ) : (
        <>
          <SessionGateRefresh />
          {auth_error === "link_invalid" && (
            <p className="auth-error" role="alert">邮件链接已失效或无法验证。请使用邮箱和密码登录；没有账户可在下方注册。</p>
          )}
          <PasswordLoginForm />
          <p className="auth-hint">
            开始 48 题测试前需要登录。结果保存在你的账户中，只有登录该账户才能查看。
          </p>
        </>
      )}
    </main>
  );
}
