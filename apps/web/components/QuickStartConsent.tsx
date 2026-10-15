"use client";

import Link from "next/link";
import { useState } from "react";
import { rememberResearchConsentIntent } from "../lib/research-consent-store";

/**
 * 测试前说明页的可选匿名研究授权 + 开始按钮。
 *
 * 授权与「开始测试」分成两个互不阻断的动作：复选框默认未勾选，视觉权重低于
 * 主按钮，不勾选也能进入测试。点击时把本次意图写进 sessionStorage，由答题页
 * 读取后交给服务端换取真实授权记录——前端这个值只是意图，不是授权本身。
 *
 * 使用原生 checkbox 而非自绘控件：微信 X5 内核与读屏软件对原生控件的支持最稳。
 */
export function QuickStartConsent() {
  const [granted, setGranted] = useState(false);

  return (
    <>
      <section className="consent-block" aria-labelledby="research-consent-heading">
        <h2 className="consent-heading" id="research-consent-heading">关于这次答题数据</h2>
        <p className="consent-note">
          为改进题目和算法，你可以选择匿名贡献本次答题数据。该数据不会要求填写导师姓名、学校或课题组等身份信息。
        </p>
        <label className="consent-choice">
          <input type="checkbox" checked={granted} onChange={(event) => setGranted(event.target.checked)} />
          <span className="consent-choice-text">
            我愿意匿名贡献本次答题数据，用于导师BTI题目与算法改进
            <span className="consent-optional">可选</span>
          </span>
        </label>
        <p className="consent-note consent-note-quiet">
          不勾选也可以完整答完 48 题并看到结果；派生结果仍会保存到你的账户。我们收集什么、保存多久、怎么撤回，见
          <Link href="/privacy">隐私说明</Link>。
        </p>
      </section>

      <Link
        className="button button-primary"
        href="/quick/test"
        onClick={() => rememberResearchConsentIntent(granted)}
      >
        我已了解，开始测试
      </Link>
    </>
  );
}
