import { btiContent } from "@mentor-bti/bti-content";
import Link from "next/link";

const matrixOrder = ["SC", "SO", "FC", "FO"] as const;

export default function DomainsPage() {
  return (
    <main className="site-shell page-content domain-guide-page">
      <p className="eyebrow">导师BTI · 四大科研域</p>
      <h1 className="page-title">先看科研生态，<br />再看具体带人方式。</h1>
      <p className="page-intro">科研议题（探索／任务）与资源生态（纵深／网络）共同形成四大科研域。这里描述环境如何运作，而不是给导师做优劣排序；完整角色图鉴仅在 <Link href="/types">16型百科</Link> 查看。</p>
      <div className="domain-page-list">
        {btiContent.domains.domains.map((domain) => {
          const types = btiContent.personalities.filter((personality) => personality.domain === domain.code);
          return <section className="domain-detail domain-ecology" id={domain.code} key={domain.code} style={{ "--domain": domain.color, "--domain-light": domain.lightColor, "--domain-dark": domain.darkColor } as React.CSSProperties}>
            <header className="domain-detail-intro"><span className="domain-detail-accent" aria-hidden="true" /><span>{domain.code}</span><p className="domain-worldview">{domain.worldview}</p><h2>{domain.name}</h2><h3>{domain.subtitle}</h3><p>{domain.description}</p></header>
            <div className="domain-ecology-grid">
              <article><span>典型问题</span><p>{domain.question}</p></article>
              <article><span>资源结构</span><p>{domain.resourceStructure}</p></article>
              <article><span>研究节奏</span><p>{domain.researchRhythm}</p></article>
              <article><span>适配学生</span><p>{domain.fitStudents}</p></article>
            </div>
            <section className="domain-differentiation" aria-labelledby={`${domain.code}-matrix-heading`}>
              <div className="domain-differentiation-heading"><div><p className="eyebrow">本域四型分化</p><h3 id={`${domain.code}-matrix-heading`}>同一生态，带人方式仍会不同。</h3></div><Link href={`/types?domain=${domain.code}`} className="text-link">查看本域16型图鉴 <span>→</span></Link></div>
              <div className="domain-type-matrix" aria-label={`${domain.name}四型分化图：按 S/F 与 C/O 展示`}>
                <span className="matrix-corner">S / F × C / O</span><span className="matrix-column-label">C</span><span className="matrix-column-label">O</span>
                <span className="matrix-row-label">S</span>
                {matrixOrder.slice(0, 2).map((suffix) => { const personality = types.find((candidate) => candidate.code.endsWith(suffix)); return personality ? <Link href={`/types/${personality.code.toLowerCase()}`} className="domain-type-cell" key={personality.code}><strong>{personality.code}</strong><span>{personality.name}</span></Link> : <span className="domain-type-cell domain-type-cell-missing" key={suffix}>内容待补充</span>; })}
                <span className="matrix-row-label">F</span>
                {matrixOrder.slice(2).map((suffix) => { const personality = types.find((candidate) => candidate.code.endsWith(suffix)); return personality ? <Link href={`/types/${personality.code.toLowerCase()}`} className="domain-type-cell" key={personality.code}><strong>{personality.code}</strong><span>{personality.name}</span></Link> : <span className="domain-type-cell domain-type-cell-missing" key={suffix}>内容待补充</span>; })}
              </div>
              <p className="matrix-axis-note">行轴 S / F：结构治理 / 弹性治理 · 列轴 C / O：能力形成 / 成果交付</p>
            </section>
          </section>;
        })}
      </div>
    </main>
  );
}
