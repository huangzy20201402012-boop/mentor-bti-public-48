"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicStatsSnapshot } from "../lib/public-stats";

const formatNumber = new Intl.NumberFormat("zh-CN");
const REFRESH_INTERVAL_MS = 10_000;

function validSnapshot(value: unknown): value is PublicStatsSnapshot {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PublicStatsSnapshot>;
  return typeof item.startedAt === "string"
    && [item.pageViews, item.registeredAccounts, item.completedTests].every(
      (count) => Number.isSafeInteger(count) && (count as number) >= 0
    );
}

export function PublicStats() {
  const [stats, setStats] = useState<PublicStatsSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let latestRequest = 0;
    async function refresh(fresh = false) {
      const request = ++latestRequest;
      try {
        const response = await fetch(fresh ? `/api/public-stats?fresh=${Date.now()}` : "/api/public-stats", {
          cache: fresh ? "no-store" : "default"
        });
        if (!response.ok) throw new Error("unavailable");
        const payload: unknown = await response.json();
        if (!validSnapshot(payload)) throw new Error("invalid_snapshot");
        if (active && request === latestRequest) { setStats(payload); setFailed(false); }
      } catch {
        if (active && request === latestRequest) setFailed(true);
      }
    }

    void refresh();
    const handleChange = () => { void refresh(true); };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("mentor-bti:stats-changed", handleChange);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("mentor-bti:stats-changed", handleChange);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <section className="public-stats" aria-label="公开体验数据">
      <p className="public-stats-title">一起见证导师BTI的成长</p>
      {stats ? (
        <div className="public-stats-grid">
          <div><strong>{formatNumber.format(stats.pageViews)}</strong><span>页面浏览次数</span></div>
          <div><strong>{formatNumber.format(stats.registeredAccounts)}</strong><span>累计注册账户</span></div>
          <div><strong>{formatNumber.format(stats.completedTests)}</strong><span>完成 48 题次数</span></div>
        </div>
      ) : (
        <p className="public-stats-status" role="status">{failed ? "公开数据暂时无法加载" : "正在加载公开数据…"}</p>
      )}
      {stats && failed ? <p className="public-stats-status" role="status">更新失败，当前显示的是上次取得的数字。</p> : null}
      <p className="public-stats-status">页面打开期间约每 10 秒更新一次</p>
      <Link className="public-stats-details" href="/metrics">查看统计口径 →</Link>
    </section>
  );
}
