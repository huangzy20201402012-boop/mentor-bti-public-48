import type { Metadata } from "next";
import Link from "next/link";
import { publicStatsStartAt } from "../../lib/public-stats";

export const metadata: Metadata = {
  title: "公开数据说明｜导师BTI",
  description: "导师BTI 页面浏览、累计注册账户和 48 题完成次数的统计口径。"
};

export const dynamic = "force-dynamic";

function startLabel(): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(publicStatsStartAt(process.env.PUBLIC_METRICS_START_AT)));
}

export default function MetricsPage() {
  return (
    <main className="statement site-shell privacy-page">
      <p className="eyebrow">导师BTI · 公开数据</p>
      <h1>这些数字怎么算？</h1>
      <p className="privacy-lede">页脚的浏览次数和完成 48 题次数从 {startLabel()}（北京时间）起算；注册账户是当前累计总数，包含此前的测试账户。浏览次数不是独立访客人数。</p>
      <section className="privacy-section">
        <h2>三个数字</h2>
        <ul className="privacy-list">
          <li><strong>页面浏览次数</strong><span>普通产品页面每次打开或切换产生一条成功保存的浏览记录。重复访问或刷新会再次计数；账户页、此说明页和后台不计入。它不能代表独立访客人数。</span></li>
          <li><strong>累计注册账户</strong><span>Supabase Auth 中目前仍存在的全部账户，包含上线前创建的测试账户。删除账户会使数字减少；不公开邮箱或个人资料。</span></li>
          <li><strong>完成 48 题次数</strong><span>只计算成功保存到用户账户的 48 题结果。未完成的答题不计；同一人多次完成会分别计数。</span></li>
        </ul>
      </section>
      <section className="privacy-section">
        <h2>更新与局限</h2>
        <p>页面打开时会读取汇总，打开期间约每 10 秒检查一次；浏览记录或注册成功后会立即重新读取。常规请求可能有约 5 秒缓存，因此其他访客的变化通常在约 15 秒内可见。浏览器开启「请勿追踪」、网络中断或拦截统计请求时，访问不会计入，因此浏览量可能低于实际访问量。</p>
        <p>这些数字未做真人身份核验，不适合作为独立用户数或有效传播人数使用。<Link href="/privacy">查看隐私说明</Link></p>
      </section>
      <Link className="text-button" href="/">返回首页</Link>
    </main>
  );
}
