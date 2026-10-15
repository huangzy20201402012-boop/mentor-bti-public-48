"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="statement" role="alert">
      <p className="eyebrow">导师BTI</p>
      <h1>页面暂时无法打开。</h1>
      <p>这不会影响你的本机答题数据。请重试；若问题持续出现，可重新开始测试。</p>
      <button className="button button-primary" type="button" onClick={reset}>重试</button>
    </main>
  );
}
