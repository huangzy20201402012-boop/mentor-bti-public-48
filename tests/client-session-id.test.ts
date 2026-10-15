import { describe, expect, it } from "vitest";
import { createClientSessionId } from "../apps/web/lib/client-session-id";

describe("手机客户端会话 ID", () => {
  it("uses randomUUID when the browser provides it", () => {
    const nativeId = "00000000-0000-4000-8000-000000000001";
    expect(createClientSessionId({ cryptoSource: { randomUUID: () => nativeId, getRandomValues: () => new Uint32Array() } })).toBe(nativeId);
  });

  it("falls back safely when an HTTP LAN browser has no crypto API", () => {
    expect(createClientSessionId({ cryptoSource: null, now: 1, random: () => 0.5 })).toBe("quick-1-i");
  });

  it("falls back when a browser exposes randomUUID but rejects it on HTTP", () => {
    const cryptoSource = {
      randomUUID: () => { throw new DOMException("Secure context required", "SecurityError"); },
      getRandomValues: () => { throw new DOMException("Secure context required", "SecurityError"); }
    } as unknown as Crypto;
    expect(createClientSessionId({ cryptoSource, now: 2, random: () => 0.25 })).toBe("quick-2-9");
  });
});
