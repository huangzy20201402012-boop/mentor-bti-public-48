import { describe, expect, it } from "vitest";
import {
  DEFAULT_PUBLIC_STATS_START_AT,
  isCountedPagePath,
  publicStatsStartAt
} from "../apps/web/lib/public-stats";

describe("public counter definitions", () => {
  it("counts product pages and excludes counter, account and infrastructure routes", () => {
    expect(isCountedPagePath("/")).toBe(true);
    expect(isCountedPagePath("/quick/test")).toBe(true);
    expect(isCountedPagePath("/result/quick/example")).toBe(true);
    expect(isCountedPagePath("/account")).toBe(false);
    expect(isCountedPagePath("/account/settings")).toBe(false);
    expect(isCountedPagePath("/metrics")).toBe(false);
    expect(isCountedPagePath("/admin/reports")).toBe(false);
    expect(isCountedPagePath("/api/public-stats")).toBe(false);
    expect(isCountedPagePath("//offsite.example")).toBe(false);
  });

  it("uses the agreed rollout time unless a valid deploy-time override is provided", () => {
    expect(publicStatsStartAt(undefined)).toBe(DEFAULT_PUBLIC_STATS_START_AT);
    expect(publicStatsStartAt("not-a-date")).toBe(DEFAULT_PUBLIC_STATS_START_AT);
    expect(publicStatsStartAt("2026-10-14T12:00:00+08:00")).toBe("2026-10-14T04:00:00.000Z");
  });
});
