import { btiContent } from "@mentor-bti/bti-content";
import Link from "next/link";
import { AnalyticsEventOnMount } from "../components/AnalyticsPageView";
import { CharacterPortrait } from "../components/CharacterPortrait";
import { DomainCard } from "../components/DomainCard";
import { TypeCard } from "../components/TypeCard";

export default function HomePage() {
  const featuredHeroCodes = ["EDSC", "ENSO", "MDFC", "MNFO"];
  const featuredTypeCodes = ["EDSC", "ENFC", "MDSO", "MNFC"];
  const featuredHeroPersonalities = featuredHeroCodes.flatMap((code) => btiContent.personalities.find((personality) => personality.code === code) ?? []);
  const featuredPersonalities = featuredTypeCodes.flatMap((code) => btiContent.personalities.find((personality) => personality.code === code) ?? []);
  return (
    <main>
      <AnalyticsEventOnMount eventName="landing_view" />
      <section className="hero site-shell">
        <div className="hero-copy">
          <p className="eyebrow brand-eyebrow"><strong>导师BTI</strong><span>硕博生科研生态测试</span></p>
          <h1>你的导师，<br />是哪一种？</h1>
          <p className="hero-lead">48道科研日常题，认识你和导师之间形成的科研生态。</p>
          <div className="hero-actions">
            <Link className="button button-primary button-hero-cta" href="/quick/start">开始48题免费速测 <span className="cta-arrow" aria-hidden="true">→</span></Link>
            <Link className="text-link" href="/types">查看16型导师 <span aria-hidden="true">→</span></Link>
          </div>
          <p className="notice"><span className="notice-dot" aria-hidden="true" />48题免费 · 登录后作答 · 无需填写导师姓名</p>
        </div>
        <div className="hero-characters" aria-label="四种导师角色示例">
          {featuredHeroPersonalities.map((personality) => (
            <Link className="hero-character" key={personality.code} href={`/types/${personality.code.toLowerCase()}`} style={{ "--type-color": personality.color } as React.CSSProperties}>
              <CharacterPortrait code={personality.code} name={personality.name} />
              <span className="hero-character-meta"><strong>{personality.name}</strong><em>{personality.code}</em></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section site-shell" aria-labelledby="domain-heading">
        <div className="section-heading"><p className="eyebrow">01 · 科研域</p><h2 id="domain-heading">先看见科研生态的底色</h2></div>
        <div className="domain-grid">{btiContent.domains.domains.map((domain) => <DomainCard domain={domain} key={domain.code} />)}</div>
      </section>

      <section className="section feature-band">
        <div className="site-shell split-content">
          <div><p className="eyebrow">不是导师评分</p><h2>类型不等于实力，<br />资源也不等于可达。</h2></div>
          <p>导师BTI关注的是学生在当前阶段感知到的科研方式、资源倾向与指导互动。它不提供总分、不做排行榜，也不把任何一种类型包装成“更好”。</p>
        </div>
      </section>

      <section className="section site-shell" aria-labelledby="types-heading">
        <div className="section-heading section-heading-row"><div><p className="eyebrow">02 · 16型导师</p><h2 id="types-heading">每一种方式，都有它的科研语言</h2></div><Link className="text-link" href="/types">浏览完整图鉴 <span>→</span></Link></div>
        <div className="type-grid type-grid-featured">{featuredPersonalities.map((personality) => <TypeCard personality={personality} key={personality.code} />)}</div>
      </section>

    </main>
  );
}
