"use client";

import type { ShareCardPayload } from "@mentor-bti/bti-core";
import { toPng } from "html-to-image";
import { useRef, useState } from "react";
import { trackEvent } from "../lib/analytics/client";

export function ShareCard({ payload }: { payload: ShareCardPayload }) {
  const cardRef = useRef<HTMLElement>(null);
  const [shareState, setShareState] = useState<"idle" | "loading" | "copied" | "downloaded" | "shared">("idle");
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/`;

  function resetShareState(): void {
    window.setTimeout(() => setShareState("idle"), 1800);
  }

  async function copyShareLink(): Promise<void> {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.append(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
    setShareState("copied");
    resetShareState();
  }

  async function shareWithPeers(): Promise<void> {
    const shareData = { title: "导师BTI｜48题科研生态测试", url: shareUrl };
    if (!navigator.share) {
      await copyShareLink();
      trackEvent("share_to_peer_click", { typeCode: payload.typeCode, domainCode: payload.domainCode, shareMethod: "copy" });
      return;
    }
    try {
      await navigator.share(shareData);
      trackEvent("share_to_peer_click", { typeCode: payload.typeCode, domainCode: payload.domainCode, shareMethod: "native" });
      setShareState("shared");
      resetShareState();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyShareLink();
      trackEvent("share_to_peer_click", { typeCode: payload.typeCode, domainCode: payload.domainCode, shareMethod: "copy" });
    }
  }

  async function downloadCard(): Promise<void> {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `导师BTI-${payload.typeCode}-${payload.typeName}.png`;
      link.href = dataUrl;
      link.click();
      trackEvent("share_card_generate", { typeCode: payload.typeCode, domainCode: payload.domainCode });
      trackEvent("share_card_download", { typeCode: payload.typeCode, domainCode: payload.domainCode });
      setShareState("downloaded");
    } catch {
      setShareState("idle");
      window.alert("分享卡暂时无法生成，请稍后重试。");
    }
    resetShareState();
  }

  return (
    <section className="share-section" aria-labelledby="share-heading">
      <div className="share-section-heading"><div><p className="eyebrow">分享卡</p><h2 id="share-heading">这是一张可以放心分享的结果卡。</h2></div><div className="share-actions"><button className="button button-secondary" onClick={downloadCard}>{shareState === "downloaded" ? "图片已生成" : "下载分享卡"}</button><button className="button button-primary" onClick={() => void shareWithPeers()}>{shareState === "copied" ? "网页链接已复制" : shareState === "shared" ? "已打开分享" : "分享给同门"}</button></div></div>
      <div className="share-card-wrap">
        <article ref={cardRef} className="share-card" style={{ "--share-color": payload.color } as React.CSSProperties}>
          <div className="share-card-top"><strong>导师BTI</strong><span>48题人格速测</span></div>
          <div className="share-card-portrait" aria-hidden="true"><div className="share-card-portrait-fallback"><span>◈</span><strong>{payload.typeCode}</strong></div></div>
          <div className="share-card-copy"><p className="share-domain-label">所属科研域</p><p className="share-domain">{payload.domainCode} · {payload.domainName}</p><h3>{payload.typeCode}</h3><h4>{payload.typeName}</h4><blockquote>“{payload.headline}”</blockquote></div>
          <div className="share-card-axes">{payload.axes.map((axis) => <div key={axis.code}><span>{axis.leftLetter}</span><i><b style={{ width: `${axis.leftPercent}%` }} /></i><span>{axis.rightLetter}</span></div>)}</div>
          <footer>{payload.brandLine}</footer>
        </article>
        <p className="share-note">“分享给同门”只分享导师BTI介绍页链接，不包含你的结果或测试答案。</p>
      </div>
    </section>
  );
}
