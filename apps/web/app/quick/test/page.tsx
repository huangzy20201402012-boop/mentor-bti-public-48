import { btiContent } from "@mentor-bti/bti-content";
import { QuickTestExperience } from "../../../components/QuickTestExperience";
import { LoginRequiredPage } from "../../../components/auth/LoginRequiredPage";
import { getAuthUser } from "../../../lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export default async function QuickTestPage() {
  const user = await getAuthUser();
  if (!user) {
    return <LoginRequiredPage title="登录后继续 48 题测试" description="答题和查看结果需要登录。请登录或注册后继续。" />;
  }
  return <QuickTestExperience ownerId={user.id} quickTest={btiContent.quickTest} dimensions={btiContent.dimensions} personalities={btiContent.personalities} resultRules={btiContent.resultRules} />;
}
