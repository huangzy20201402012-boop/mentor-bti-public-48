import { describe, expect, it } from "vitest";
import { prepareSocialShare, socialShareTargets } from "../apps/web/lib/social-share";

const request = {
  title: "导师BTI｜深研引导师",
  text: "我的导师BTI类型：EDSC",
  url: "https://mentor-bti.example/types/edsc",
  includesShareCard: true
} as const;

describe("社交分享适配层", () => {
  it("only exposes the configured, non-identifying target platforms", () => {
    expect(socialShareTargets.map((target) => target.platform)).toEqual(["wechat", "qq-zone", "douyin", "xiaohongshu"]);
  });

  it("prepares QQ 空间 with its web sharing URL", () => {
    const target = prepareSocialShare({ ...request, platform: "qq-zone" });
    expect(target.method).toBe("web-url");
    expect(target.shareUrl).toContain("connect.qq.com/widget/shareqq/index.html");
    expect(target.shareUrl).toContain(encodeURIComponent(request.url));
  });

  it("keeps WeChat, 抖音 and 小红书 on the native system sheet", () => {
    for (const platform of ["wechat", "douyin", "xiaohongshu"] as const) {
      expect(prepareSocialShare({ ...request, platform })).toMatchObject({ platform, method: "native-sheet" });
    }
  });
});
