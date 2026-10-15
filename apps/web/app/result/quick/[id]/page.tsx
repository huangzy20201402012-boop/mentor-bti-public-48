import { btiContent } from "@mentor-bti/bti-content";
import type { QuickResult } from "@mentor-bti/bti-core";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { QuickResultView } from "../../../../components/QuickResultView";
import { LoginRequiredPage } from "../../../../components/auth/LoginRequiredPage";
import { fetchOwnCloudQuickResult } from "../../../../lib/cloud/result-lookup";
import { createSupabaseAuthServerClient, getAuthUser } from "../../../../lib/supabase/auth-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "我的测试结果｜导师BTI",
  robots: { index: false, follow: false }
};

export default async function QuickResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Old sample links lead to the public introduction. Personal reports live
  // only under an authenticated account; public descriptions remain /types.
  if (id === "sample") redirect("/");

  const user = await getAuthUser();
  if (!user) {
    return <LoginRequiredPage title="登录后查看你的结果" description="个人测试结果仅对完成测试的账户开放。请先登录自己的账户。" />;
  }

  const supabase = await createSupabaseAuthServerClient();
  const result = supabase ? await fetchOwnCloudQuickResult<QuickResult>(
    {
      currentUserId: async () => user.id,
      findOwn: (ownerId, resultKey) => supabase
        .from("quick_results")
        .select("content_version, result_payload")
        .eq("owner_id", ownerId)
        .eq("result_key", resultKey)
        .limit(1)
    },
    { resultKey: id, contentVersion: btiContent.quickTest.version }
  ) : null;

  if (!result) {
    return (
      <main className="statement site-shell">
        <p className="eyebrow">导师BTI</p>
        <h1>暂时无法打开这份结果</h1>
        <p>请确认你已登录完成这次测试的账户，或稍后重试。账户中保存的结果可在“我的账户”查看。</p>
        <p><Link className="text-button" href="/account">前往我的账户</Link></p>
        <Link className="button button-primary" href="/quick/start">开始 48 题测试</Link>
      </main>
    );
  }

  return <QuickResultView result={result} resultKey={id} ownerId={user.id} />;
}
