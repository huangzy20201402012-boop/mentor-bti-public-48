import { btiContent } from "@mentor-bti/bti-content";
import type { ResearchDomainCode } from "@mentor-bti/bti-core";
import { TypeCard } from "../../components/TypeCard";

const domainCodes = new Set<ResearchDomainCode>(["ED", "EN", "MD", "MN"]);

export default async function TypesPage({ searchParams }: { searchParams: Promise<{ domain?: string }> }) {
  const requestedDomain = (await searchParams).domain?.toUpperCase();
  const selectedDomain = requestedDomain && domainCodes.has(requestedDomain as ResearchDomainCode) ? requestedDomain as ResearchDomainCode : undefined;
  const visibleDomains = btiContent.domains.domains.filter((domain) => !selectedDomain || domain.code === selectedDomain);
  return (
    <main className="site-shell page-content">
      <p className="eyebrow">导师BTI · 16型图鉴</p>
      <h1 className="page-title">{selectedDomain ? `${selectedDomain}科研域的四种带人方式。` : <>16种科研带人方式，<br />没有统一标准答案。</>}</h1>
      <p className="page-intro">四条TYPE轴共同形成16种基础导师类型。每一型都呈现其人物卡、灵魂文案、优势、潜在挑战和更适配的学生需求。</p>
      {visibleDomains.map((domain) => (
        <section className="type-domain-section" key={domain.code}>
          <div className="type-domain-heading" style={{ "--domain": domain.color, "--domain-dark": domain.darkColor } as React.CSSProperties}><span>{domain.code}</span><h2>{domain.name}</h2><p>{domain.subtitle}</p></div>
          <div className="type-grid">{btiContent.personalities.filter((personality) => personality.domain === domain.code).map((personality) => <TypeCard personality={personality} key={personality.code} />)}</div>
        </section>
      ))}
    </main>
  );
}
