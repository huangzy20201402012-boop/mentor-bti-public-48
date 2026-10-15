import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthCallbackUrl } from "../apps/web/lib/auth/redirect-origin";

describe("email sign-in redirect origin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns the callback only on the configured site", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    expect(getAuthCallbackUrl("https://example.com"))
      .toBe("https://example.com/auth/callback");
  });

  it("rejects unrelated hosts and URL suffixes", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    expect(getAuthCallbackUrl("https://attacker.netlify.app")).toBeNull();
    expect(getAuthCallbackUrl("https://example.com.attacker.test")).toBeNull();
    expect(getAuthCallbackUrl("https://example.com/path"))
      .toBeNull();
  });
});
