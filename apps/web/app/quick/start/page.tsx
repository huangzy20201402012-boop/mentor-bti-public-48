import { AnalyticsEventOnMount } from "../../../components/AnalyticsPageView";
import { QuickStartConsent } from "../../../components/QuickStartConsent";
import { LoginRequiredPage } from "../../../components/auth/LoginRequiredPage";
import { getAuthUser } from "../../../lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function QuickStartPage() {
  if (!(await getAuthUser())) {
    return <LoginRequiredPage title="登录后开始 48 题测试" description="请先登录或注册账户。完成测试后，只有你登录自己的账户才能查看结果。" />;
  }

  return (
    <main className="statement">
      <AnalyticsEventOnMount eventName="quick_test_intro_view" />
      <p className="eyebrow">导师BTI｜48题人格速测</p>
      <h1>开始前说明</h1>
      <p>本测试是一款面向硕博生及科研训练人群的娱乐型导师科研风格测试。</p>
      <p>结果反映你在当前阶段对科研互动关系的主观感知，不构成心理诊断、职业评价或导师排名。</p>
      <QuickStartConsent />
    </main>
  );
}
