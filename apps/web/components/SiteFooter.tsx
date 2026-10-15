import Link from "next/link";
import { PublicStats } from "./PublicStats";
import { GeneralFeedbackEntry } from "./feedback/GeneralFeedbackEntry";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-shell footer-inner">
        <strong>导师BTI</strong>
        <p>不是给导师排名，而是看清你身处怎样的科研生态。</p>
        <PublicStats />
        <p className="fine-print">测试结果反映答题者对当前科研互动的主观感知，不构成心理诊断、职业评价或导师排名。</p>
        <GeneralFeedbackEntry />
        <p className="footer-privacy"><Link href="/privacy">隐私说明</Link> · <Link href="/feedback">登录后反馈</Link> · <Link href="/account">我的账户</Link></p>
      </div>
    </footer>
  );
}

