import { btiContent } from "@mentor-bti/bti-content";
import type { AxisId } from "@mentor-bti/bti-core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CharacterPortrait } from "../../../components/CharacterPortrait";

const axisLabels: Record<AxisId, { left: { letter: string; label: string }; right: { letter: string; label: string } }> = {
  em: { left: { letter: "E", label: "探索驱动" }, right: { letter: "M", label: "任务驱动" } },
  dn: { left: { letter: "D", label: "纵深资源" }, right: { letter: "N", label: "网络资源" } },
  sf: { left: { letter: "S", label: "结构治理" }, right: { letter: "F", label: "弹性治理" } },
  co: { left: { letter: "C", label: "能力形成" }, right: { letter: "O", label: "成果交付" } }
};

export function generateStaticParams() {
  return btiContent.personalities.map((personality) => ({ code: personality.code.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const personality = btiContent.personalities.find((candidate) => candidate.code === code.toUpperCase());
  if (!personality) return { title: "类型未找到｜导师BTI" };
  return {
    title: `${personality.name}（${personality.code}）｜导师BTI`,
    description: personality.summary,
    openGraph: { title: `${personality.name}（${personality.code}）｜导师BTI`, description: personality.headline }
  };
}

export default async function TypeDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const personality = btiContent.personalities.find((candidate) => candidate.code === code.toUpperCase());
  const domain = personality ? btiContent.domains.domains.find((candidate) => candidate.code === personality.domain) : undefined;
  if (!personality || !domain) notFound();

  return (
    <main className="site-shell type-detail" style={{ "--type-color": personality.color, "--type-light": domain.lightColor } as React.CSSProperties}>
      <section className="type-detail-hero">
        <div className="type-detail-copy"><p className="type-detail-code">{personality.code}</p><p className="eyebrow">{domain.name}</p><h1>{personality.name}</h1><p className="type-archetype">{personality.englishName}</p><p className="type-headline">“{personality.headline}”</p><p>{personality.summary}</p></div>
        <CharacterPortrait code={personality.code} name={personality.name} className="detail-portrait" />
      </section>
      <section className="axis-panel" aria-label="四轴倾向">
        {Object.entries(personality.axes).map(([axis, letter]) => { const labels = axisLabels[axis as AxisId]; const isLeft = letter === labels.left.letter; return <div className="axis-item" key={axis} style={{ "--axis-pos": isLeft ? "14%" : "86%" } as React.CSSProperties}><div className="axis-item-head"><span className={`axis-half ${isLeft ? "axis-half-active" : ""}`}><b>{labels.left.letter}</b><i>{labels.left.label}</i></span><span className={`axis-half axis-half-right ${!isLeft ? "axis-half-active" : ""}`}><i>{labels.right.label}</i><b>{labels.right.letter}</b></span></div><div className="axis-item-track"><i /></div></div>; })}
      </section>
      <section className="type-detail-grid">
        <article><p className="eyebrow">典型优势</p><ul>{personality.strengths.map((item) => <li key={item}>{item}</li>)}</ul></article>
        <article><p className="eyebrow">潜在挑战</p><ul>{personality.challenges.map((item) => <li key={item}>{item}</li>)}</ul></article>
        <article className="fit-card"><p className="eyebrow">更适配的学生</p><p>{personality.bestFitStudents}</p><blockquote>“{personality.quote}”</blockquote></article>
      </section>
    </main>
  );
}
