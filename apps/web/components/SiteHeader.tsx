import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-shell header-inner">
        <Link className="brand" href="/">导师BTI<span>·</span></Link>
        <nav aria-label="主导航">
          <Link href="/domains">科研域</Link>
          <Link href="/types">16型百科</Link>
          <Link href="/quick/start">免费测试</Link>
          <Link href="/account">我的账户</Link>
        </nav>
      </div>
    </header>
  );
}
