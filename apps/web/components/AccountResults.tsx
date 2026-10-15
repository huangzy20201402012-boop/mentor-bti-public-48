"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AccountResultsSnapshot } from "../lib/cloud/account-results";
import { fetchOwnQuickResults } from "../lib/cloud/client";

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "时间未知";
  // 固定用 UTC+8 展示，避免服务端与浏览器时区不同导致同一行显示两个日期。
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(parsed);
}

/**
 * 当前账户的 48 题结果列表。
 *
 * 只显示自己的记录：过滤在 RLS 和查询两处都写着。
 *
 * 「读不到」和「没有记录」是两种状态，文案必须分开：云端历史是附加价值，
 * 所以两种失败都不报错、都不阻断，但也不能
 * 把一次读失败说成「你还没有结果」——那会让一个明明存过结果的用户以为丢了。
 */
export function AccountResults() {
  const [snapshot, setSnapshot] = useState<AccountResultsSnapshot | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchOwnQuickResults().then((loaded) => { if (!cancelled) setSnapshot(loaded); });
    return () => { cancelled = true; };
  }, [attempt]);

  function retry(): void {
    setSnapshot(null);
    setAttempt((current) => current + 1);
  }

  if (snapshot === null) return <p className="account-empty" role="status">正在读取你的结果…</p>;

  if (snapshot.outcome === "signed_out") {
    return (
      <div className="account-empty">
        <p>登录状态已失效，暂时读不到你的结果。</p>
        <p className="auth-hint">刷新页面后重新登录即可再次查看。已经保存到账号的结果不会丢失。</p>
        {/* 重新读一次也没用——失效的是会话本身，得让服务端重新渲染整页。 */}
        <button className="text-button" type="button" onClick={() => window.location.reload()}>刷新页面</button>
      </div>
    );
  }

  if (snapshot.outcome === "unavailable") {
    return (
      <div className="account-empty" role="status">
        <p>暂时读不到你的结果，可能是网络问题。</p>
        <p className="auth-hint">已经保存到账号的结果不会丢失，可以稍后再试。</p>
        <button className="text-button" type="button" onClick={retry}>重试</button>
      </div>
    );
  }

  if (snapshot.results.length === 0) {
    return (
      <div className="account-empty">
        <p>还没有保存到账号的测试结果。</p>
        <p className="auth-hint">旧版本仅保存在浏览器中的结果不会自动进入账户。完成一次新测试后，结果会保存到当前账户。</p>
        <Link className="button button-primary" href="/quick/start">开始 48 题测试</Link>
      </div>
    );
  }

  return (
    <ul className="account-result-list">
      {snapshot.results.map((result) => (
        <li key={result.id}>
          <div>
            <p className="account-result-type">{result.typeCode ?? "结果"}{result.domainCode ? ` · ${result.domainCode}` : ""}</p>
            <p className="account-result-meta">{formatDate(result.createdAt)}</p>
          </div>
          {/* result_key 缺失时没有可跳转的目标；链接到不存在的结果页比不显示链接更糟。 */}
          {result.resultKey ? <Link className="text-button" href={`/result/quick/${encodeURIComponent(result.resultKey)}`}>查看</Link> : null}
        </li>
      ))}
    </ul>
  );
}
