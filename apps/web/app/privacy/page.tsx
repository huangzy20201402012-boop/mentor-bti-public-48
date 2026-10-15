import type { Metadata } from "next";
import Link from "next/link";
import { PRIVACY_VERSION } from "../../lib/analytics/version";

export const metadata: Metadata = {
  title: "隐私说明｜导师BTI",
  description: "导师BTI 收集什么、不收集什么、保存多久，以及你随时可以不提供什么。"
};

/**
 * 用户可见的隐私说明。写法上刻意避免法律文本腔：用短段落和明确的「不收集」
 * 清单，让用户能在一屏内判断自己是否愿意继续。保留期限与 Codex V1.1 数据层
 * 的实际口径一致（analytics 12 个月 / 研究答案 18 个月 / 联系方式按许可存续）。
 */
export default function PrivacyPage() {
  return (
    <main className="statement privacy-page">
      <p className="eyebrow">导师BTI</p>
      <h1>隐私说明</h1>
      <p className="privacy-lede">
        48 题测试需要账户登录。匿名研究数据收集仍由你单独选择；拒绝不影响答题和查看自己的结果。
      </p>

      <section className="privacy-section">
        <h2>我们收集什么</h2>
        <ul className="privacy-list">
          <li>
            <strong>账户邮箱与测试结果</strong>
            <span>邮箱用于注册和登录。完成测试后，我们将类型、维度等派生结果保存到你的账户，供你再次登录查看；结果页只对这个账户开放。</span>
          </li>
          <li>
            <strong>匿名的页面访问记录</strong>
            <span>例如「进入测试」「答完并查看结果」「点击分享」。这类记录不含你的任何答案内容。</span>
          </li>
          <li>
            <strong>匿名的答题数据（仅在你勾选同意时）</strong>
            <span>你选了哪个选项、在哪道题上花了多久。用于发现题意不清的题目和校准计分，不用于评价你个人。</span>
          </li>
          <li>
            <strong>访谈联系邮箱（仅在你另行填写时）</strong>
            <span>只在你想参加后续访谈或内测时收集，单独存放，不与匿名研究答题记录合并。</span>
          </li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>我们不会收集什么</h2>
        <p>
          任何时候我们都不会要求或保存你的<strong>导师姓名、学校、课题组</strong>，也不会要求手机号、学号、身份证号。
          反馈输入框旁也会提示你不要填写这些信息。
        </p>
      </section>

      <section className="privacy-section">
        <h2>你可以怎么选</h2>
        <ul className="privacy-list">
          <li>
            <strong>匿名研究授权：可选，默认不勾选</strong>
            <span>在开始测试前的说明页选择。不勾选同样可以完整答完 48 题、看到结果、下载分享卡。每次开始新测试都会重新询问一次。</span>
          </li>
          <li>
            <strong>额外的访谈联系邮箱：可选</strong>
            <span>账户邮箱用于登录；是否另行提供访谈联系方式由你决定。</span>
          </li>
          <li>
            <strong>浏览器的「请勿追踪」（DNT）</strong>
            <span>如果你开启了 DNT，我们不会采集上面第一类页面访问记录。你仍然可以单独、明确地同意匿名研究授权。</span>
          </li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>保存多久</h2>
        <ul className="privacy-list">
          <li><strong>页面访问记录</strong><span>12 个月后删除。</span></li>
          <li><strong>匿名答题数据</strong><span>18 个月后删除。</span></li>
          <li><strong>额外留下的访谈联系邮箱</strong><span>在你撤回许可、或这次访谈邀请完成后删除。</span></li>
        </ul>
      </section>

      <section className="privacy-section">
        <h2>怎么撤回</h2>
        <p>
          你可以在页脚点「提交建议 / 报告问题」联系我们，提出撤回匿名研究授权、删除访谈联系方式或账户数据的请求。
          匿名研究答题数据不与账户身份绑定；如果需要定位某次匿名记录，请提供大致时间和你记得的答题特征。
        </p>
        <p>
          <strong>完成后的个人结果保存在你的账户中</strong>。更换设备后，登录原账户仍可查看已保存的结果。未交卷的答题进度保存在当前设备的浏览器中。
        </p>
      </section>

      <section className="privacy-section">
        <h2>结果的性质</h2>
        <p>
          测试结果反映你在当前阶段对科研互动关系的主观感知，不构成心理诊断、职业评价或导师排名。
        </p>
      </section>

      <p className="privacy-version">
        本说明版本：{PRIVACY_VERSION}
      </p>

      <Link className="button button-primary" href="/quick/start">返回开始测试</Link>
    </main>
  );
}
