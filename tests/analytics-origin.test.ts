import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isSameOriginRequest } from "../apps/web/lib/analytics/server";

const publicOrigin = "https://user-test--mentor-bti-feedback-preview-20261006.netlify.app";

function request(url: string, headers: Record<string, string>): Request {
  return new Request(url, { method: "POST", headers });
}

describe("analytics POST origin validation", () => {
  it("accepts the public Host when a proxy gives Next.js an internal request URL", () => {
    expect(isSameOriginRequest(request("http://internal.local/api/result-feedback", {
      origin: publicOrigin,
      host: new URL(publicOrigin).host
    }))).toBe(true);
  });

  it("rejects a different origin even with a public Host", () => {
    expect(isSameOriginRequest(request("http://internal.local/api/result-feedback", {
      origin: "https://untrusted.example",
      host: new URL(publicOrigin).host
    }))).toBe(false);
  });

  it("accepts direct same-origin and no-Origin requests", () => {
    expect(isSameOriginRequest(request(`${publicOrigin}/api/result-feedback`, { origin: publicOrigin }))).toBe(true);
    expect(isSameOriginRequest(request(`${publicOrigin}/api/result-feedback`, {}))).toBe(true);
  });

  it("rejects malformed and opaque origins", () => {
    expect(isSameOriginRequest(request(`${publicOrigin}/api/result-feedback`, { origin: "null" }))).toBe(false);
    expect(isSameOriginRequest(request(`${publicOrigin}/api/result-feedback`, { origin: `${publicOrigin}/other` }))).toBe(false);
  });
});
