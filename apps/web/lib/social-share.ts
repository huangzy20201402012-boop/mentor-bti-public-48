import type { SocialShareRequest, SocialShareTarget } from "@mentor-bti/bti-core";

export const socialShareTargets: Array<Pick<SocialShareTarget, "platform" | "label" | "method">> = [
  { platform: "wechat", label: "微信", method: "native-sheet" },
  { platform: "qq-zone", label: "QQ 空间", method: "web-url" },
  { platform: "douyin", label: "抖音", method: "native-sheet" },
  { platform: "xiaohongshu", label: "小红书", method: "native-sheet" }
];

/**
 * QQ 空间 exposes a browser sharing endpoint. Other Chinese content apps are
 * deliberately routed through the OS sheet: a public website cannot reliably
 * force-open them or prefill a post without their approved SDK / account setup.
 */
export function prepareSocialShare(request: SocialShareRequest): SocialShareTarget {
  const target = socialShareTargets.find((item) => item.platform === request.platform);
  if (!target) return { platform: "system", label: "更多应用", method: "native-sheet" };

  if (request.platform === "qq-zone") {
    const params = new URLSearchParams({ url: request.url, title: request.title, summary: request.text });
    return { ...target, shareUrl: `https://connect.qq.com/widget/shareqq/index.html?${params.toString()}` };
  }

  return target;
}
