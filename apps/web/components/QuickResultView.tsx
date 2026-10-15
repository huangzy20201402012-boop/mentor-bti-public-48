"use client";

import { btiContent } from "@mentor-bti/bti-content";
import type { QuickOverview, QuickResult } from "@mentor-bti/bti-core";
import { createQuickShareCardPayload } from "@mentor-bti/bti-scoring";
import { useEffect, useRef, useState } from "react";
import { trackEvent } from "../lib/analytics/client";
import { getSignedInUserId } from "../lib/cloud/client";
import { getSupabaseBrowserClient } from "../lib/supabase/browser";
import { CharacterPortrait } from "./CharacterPortrait";
import { ResultFeedbackForm } from "./feedback/ResultFeedbackForm";
import { ShareCard } from "./ShareCard";

function overviewLabel(overview: QuickOverview): string {
  if (overview.score === null || overview.coverage < 0.5) return "数据有限";
  if (overview.score < 35) return "偏低";
  if (overview.score < 50) return "较低";
  if (overview.score < 65) return "适中";
  if (overview.score < 80) return "较高";
  return "突出";
}

export function QuickResultView({ result, resultKey, ownerId }: { result: QuickResult; resultKey: string; ownerId: string }) {
  const [accountStatus, setAccountStatus] = useState<"checking" | "verified" | "changed">("checking");
  const trackedViewRef = useRef(false);

  useEffect(() => {
    let active = true;
    let checkNumber = 0;
    let authChangeTimer: number | null = null;

    async function verifyAccount(): Promise<void> {
      const currentCheck = ++checkNumber;
      setAccountStatus("checking");
      const currentUserId = await getSignedInUserId();
      if (!active || currentCheck !== checkNumber) return;
      if (currentUserId !== ownerId) {
        setAccountStatus("changed");
        // A full navigation discards the old result from this tab's router state.
        window.location.replace("/account");
        return;
      }
      setAccountStatus("verified");
    }

    function verifyWhenVisible(): void {
      if (document.visibilityState === "visible") void verifyAccount();
    }

    function hideWhenLeaving(): void {
      ++checkNumber;
      setAccountStatus("checking");
    }

    function onVisibilityChange(): void {
      if (document.visibilityState === "hidden") hideWhenLeaving();
      else verifyWhenVisible();
    }

    void verifyAccount();
    window.addEventListener("pageshow", verifyWhenVisible);
    window.addEventListener("pagehide", hideWhenLeaving);
    window.addEventListener("focus", verifyWhenVisible);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const subscription = getSupabaseBrowserClient()?.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      if (event === "SIGNED_OUT") {
        ++checkNumber;
        setAccountStatus("changed");
        window.location.replace("/account");
        return;
      }
      // Wait until the auth callback has returned before asking Supabase for claims.
      if (authChangeTimer !== null) window.clearTimeout(authChangeTimer);
      authChangeTimer = window.setTimeout(() => { void verifyAccount(); }, 0);
    }).data.subscription;

    return () => {
      active = false;
      ++checkNumber;
      if (authChangeTimer !== null) window.clearTimeout(authChangeTimer);
      window.removeEventListener("pageshow", verifyWhenVisible);
      window.removeEventListener("pagehide", hideWhenLeaving);
      window.removeEventListener("focus", verifyWhenVisible);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      subscription?.unsubscribe();
    };
  }, [ownerId]);

  useEffect(() => {
    if (accountStatus !== "verified" || trackedViewRef.current) return;
    trackedViewRef.current = true;
    trackEvent("quick_result_view", { typeCode: result.typeCode, domainCode: result.personality.domain });
  }, [accountStatus, result.personality.domain, result.typeCode]);

  if (accountStatus !== "verified") {
    return (
      <main className="statement site-shell" role="status" aria-live="polite">
        <p className="eyebrow">导师BTI</p>
        <h1>{accountStatus === "changed" ? "登录状态已变化" : "正在核对你的账户…"}</h1>
        <p>{accountStatus === "changed" ? "正在返回账户页。" : "核对完成后会显示你的测试结果。"}</p>
      </main>
    );
  }

  return <QuickResultContent result={result} resultKey={resultKey} />;
}

function QuickResultContent({ result, resultKey }: { result: QuickResult; resultKey: string }) {
  const domain = btiContent.domains.domains.find((candidate) => candidate.code === result.personality.domain);
  const [motionEnabled, setMotionEnabled] = useState(false);

  useEffect(() => {
    let savedPreference: string | null = null;
    try { savedPreference = window.localStorage.getItem("mentor-bti:result-motion"); } catch { /* use system preference */ }
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMotionEnabled(savedPreference ? savedPreference === "on" : !prefersReducedMotion);
  }, []);

  function toggleMotion(): void {
    setMotionEnabled((current) => {
      const next = !current;
      try { window.localStorage.setItem("mentor-bti:result-motion", next ? "on" : "off"); } catch { /* preference remains for this view */ }
      return next;
    });
  }

  const domainName = domain?.name ?? "科研域";
  const domainLightColor = domain?.lightColor ?? "#edf2f8";
  const shareCard = createQuickShareCardPayload(result, domainName);
  const needsQualityNotice = result.responseQuality.label === "retry" || result.responseQuality.label === "cautious";

  return (
    <main className={`result-page site-shell ${motionEnabled ? "motion-on" : "motion-off"}`} style={{ "--result-color": result.personality.color, "--result-light": domainLightColor } as React.CSSProperties}>
      <section className="result-hero">
        <div className="result-hero-copy"><p className="eyebrow result-reveal result-reveal-1">你的导师BTI类型</p><p className="result-domain result-reveal result-reveal-2">{result.personality.domain} · {domainName}</p><h1 className="result-reveal result-reveal-3">{result.typeCode}</h1><h2 className="result-reveal result-reveal-4">{result.personality.name}</h2><p className="result-headline result-reveal result-reveal-5">“{result.personality.headline}”</p><p className="result-reveal result-reveal-5">{result.personality.summary}</p><div className="result-tags result-reveal result-reveal-6">{result.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>{needsQualityNotice ? <p className="result-quality-notice" role="status">本次作答数据有限，结果仅供参考；建议补充可判断的题目后重新测试。</p> : null}</div>
        <div className="result-portrait-panel result-portrait-reveal"><CharacterPortrait code={result.typeCode} name={result.personality.name} className="result-portrait" /><p className="result-stability"><span>类型稳定度</span><strong>{result.typeStability === "boundary" ? "边界倾向" : result.typeStability === "high" ? "高" : "中"}</strong><i>· 置信度 {result.typeConfidence}%</i></p></div>
      </section>

      <section className="result-section" aria-labelledby="axis-heading"><p className="eyebrow">四轴倾向</p><h2 id="axis-heading">他更习惯怎样推进科研？</h2><p className="axis-legend">每条色带表示左端字母的倾向比例；右端比例在下方同时标注。</p><div className="axis-result-grid">{Object.values(result.axes).map((axis) => <article key={axis.axis}><div><strong>{axis.left.letter}</strong><span>{axis.isBoundary ? "边界倾向" : `偏${axis.selectedLetter}`}</span><strong>{axis.right.letter}</strong></div><div className="axis-track"><i className="result-meter" style={{ "--meter-target": `${axis.left.percent}%` } as React.CSSProperties} /><b className="axis-center" aria-hidden="true" /></div><p>{axis.left.percent}% · {axis.left.letter} / {axis.right.percent}% · {axis.right.letter}</p></article>)}</div></section>

      <section className="result-section overview-section" aria-labelledby="overview-heading"><p className="eyebrow">科研生态速览</p><h2 id="overview-heading">你当前感知到的科研生态</h2><div className="overview-grid">{result.overview.map((overview) => <article key={overview.id}><span>{overview.label}</span><strong>{overviewLabel(overview)}</strong><i><b className="result-meter" style={{ "--meter-target": `${overview.score ?? 0}%` } as React.CSSProperties} /></i><small>{overview.coverage < 0.7 ? "部分信息有限" : "基于当前回答"}</small></article>)}</div></section>

      <section className="result-section result-content-grid"><article><p className="eyebrow">典型优势</p><ul>{result.personality.strengths.map((item) => <li key={item}>{item}</li>)}</ul></article><article><p className="eyebrow">潜在挑战</p><ul>{result.personality.challenges.map((item) => <li key={item}>{item}</li>)}</ul></article><article className="result-fit"><p className="eyebrow">更适配的学生</p><p>{result.personality.bestFitStudents}</p><blockquote>“{result.personality.quote}”</blockquote></article></section>

      <ResultFeedbackForm resultKey={resultKey} typeCode={result.typeCode} domainCode={result.personality.domain} />

      <ShareCard payload={shareCard} />

      <p className="result-disclaimer">结果基于答题者对当前科研互动的主观感知，不构成心理诊断、职业评价或导师排名。</p>

      <button className="result-motion-toggle" type="button" onClick={toggleMotion} aria-pressed={motionEnabled}>动效：{motionEnabled ? "开" : "关"}</button>
    </main>
  );
}
