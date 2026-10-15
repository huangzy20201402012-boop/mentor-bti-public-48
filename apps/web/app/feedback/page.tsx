import type { Metadata } from "next";
import { AccountFeedbackForm } from "../../components/feedback/AccountFeedbackForm";
import { PasswordLoginForm } from "../../components/auth/PasswordLoginForm";
import { SessionGateRefresh } from "../../components/auth/SessionGateRefresh";
import { getAuthUser } from "../../lib/supabase/auth-server";

export const metadata: Metadata = {
  title: "反馈｜导师BTI",
  robots: { index: false, follow: false }
};

// 登录态来自 cookie，静态化会把某个人的页面烤给所有人。
export const dynamic = "force-dynamic";

/**
 * 反馈入口。
 *
 * 要求登录（实施计划 §4）：这一阶段用登录来减少匿名滥用，也让用户能回看自己
 * 提交过什么。未登录时不是挡住页面，而是就地给出登录表单——把用户推到一个
 * 空页面再说「请先登录」是白费一次导航。
 */
export default async function FeedbackPage() {
  const user = await getAuthUser();

  return (
    <main className="statement site-shell feedback-page">
      <p className="eyebrow">导师BTI</p>
      <h1>告诉我们你的想法</h1>

      {user ? (
        <>
          <p>以 {user.email ?? "当前账户"} 的身份提交。反馈只包含你写下的类型与内容，不会附带你的答题记录或结果。</p>
          <AccountFeedbackForm />
        </>
      ) : (
        <>
          <SessionGateRefresh />
          <p>提交反馈需要先登录。没有账户可在下方注册，注册成功后即可继续提交。</p>
          <PasswordLoginForm />
        </>
      )}
    </main>
  );
}
