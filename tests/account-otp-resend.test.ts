import { describe, expect, it } from "vitest";
import {
  RESEND_COOLDOWN_SECONDS,
  resendLabel,
  secondsUntilResend
} from "../apps/web/lib/auth/resend-cooldown";

const SENT_AT = 1_760_000_000_000;

describe("验证码重发冷却", () => {
  it("从未发送过时立即可发", () => {
    expect(secondsUntilResend(null, SENT_AT)).toBe(0);
  });

  it("刚发出时是完整的冷却时长", () => {
    expect(secondsUntilResend(SENT_AT, SENT_AT)).toBe(RESEND_COOLDOWN_SECONDS);
  });

  it("不足一秒仍算刚发出，不提前放行", () => {
    expect(secondsUntilResend(SENT_AT, SENT_AT + 999)).toBe(RESEND_COOLDOWN_SECONDS);
  });

  it("按整秒递减", () => {
    expect(secondsUntilResend(SENT_AT, SENT_AT + 1_000)).toBe(RESEND_COOLDOWN_SECONDS - 1);
    expect(secondsUntilResend(SENT_AT, SENT_AT + 59_000)).toBe(1);
  });

  it("冷却结束的那一刻放行", () => {
    expect(secondsUntilResend(SENT_AT, SENT_AT + RESEND_COOLDOWN_SECONDS * 1_000)).toBe(0);
  });

  it("远超冷却时长后仍是 0，不出现负数", () => {
    expect(secondsUntilResend(SENT_AT, SENT_AT + 3_600_000)).toBe(0);
  });

  /**
   * 时钟回拨（或两处取时来自不同的钟）会让 elapsed 变成负数。此时必须按
   * 「刚发出」处理：放行等于把冷却整个关掉，而这是唯一一条会让用户狂点
   * 服务端的路径。
   */
  it("时钟回拨时按刚发出处理，而不是立刻放行", () => {
    expect(secondsUntilResend(SENT_AT, SENT_AT - 60_000)).toBe(RESEND_COOLDOWN_SECONDS);
  });

  it("时间戳不是有限数时当作可发，不卡死用户", () => {
    expect(secondsUntilResend(Number.NaN, SENT_AT)).toBe(0);
    expect(secondsUntilResend(SENT_AT, Number.NaN)).toBe(0);
  });
});

describe("重发按钮文案", () => {
  it("冷却中显示剩余秒数", () => {
    expect(resendLabel(1)).toBe("1 秒后可重新发送");
    expect(resendLabel(59)).toBe("59 秒后可重新发送");
  });

  it("可发时不显示 0 秒，而是可点击的文案", () => {
    expect(resendLabel(0)).toBe("重新发送验证码");
  });
});
