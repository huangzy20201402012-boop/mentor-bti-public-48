import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getServiceClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../apps/web/lib/supabase/server", () => ({ getSupabaseServiceClient: mocks.getServiceClient }));

import { loadPublicStats } from "../apps/web/lib/public-stats-server";
import { DEFAULT_PUBLIC_STATS_START_AT } from "../apps/web/lib/public-stats";

const viewQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockResolvedValue({ count: 18, error: null })
};
const resultQuery = {
  select: vi.fn().mockReturnThis(),
  gte: vi.fn().mockResolvedValue({ count: 4, error: null })
};
const listUsers = vi.fn();
const from = vi.fn((table: string) => table === "analytics_events" ? viewQuery : resultQuery);

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.PUBLIC_METRICS_START_AT;
  viewQuery.select.mockReturnThis();
  viewQuery.eq.mockReturnThis();
  viewQuery.gte.mockResolvedValue({ count: 18, error: null });
  resultQuery.select.mockReturnThis();
  resultQuery.gte.mockResolvedValue({ count: 4, error: null });
  mocks.getServiceClient.mockReturnValue({ from, auth: { admin: { listUsers } } });
  listUsers.mockResolvedValue({
    data: {
      users: [
        { created_at: "2026-10-13T00:00:00.000Z" },
        { created_at: new Date(Date.parse(DEFAULT_PUBLIC_STATS_START_AT) + 60_000).toISOString() }
      ],
      nextPage: null
    },
    error: null
  });
});

describe("public aggregate", () => {
  it("counts persisted views and results since rollout, plus all existing accounts", async () => {
    expect(await loadPublicStats()).toEqual({
      startedAt: DEFAULT_PUBLIC_STATS_START_AT,
      pageViews: 18,
      registeredAccounts: 2,
      completedTests: 4
    });
    expect(from).toHaveBeenCalledWith("analytics_events");
    expect(from).toHaveBeenCalledWith("quick_results");
    expect(viewQuery.eq).toHaveBeenCalledWith("event_name", "page_view");
    expect(viewQuery.gte).toHaveBeenCalledWith("created_at", DEFAULT_PUBLIC_STATS_START_AT);
    expect(resultQuery.gte).toHaveBeenCalledWith("created_at", DEFAULT_PUBLIC_STATS_START_AT);
  });

  it("treats a failed database count as unavailable instead of showing zero", async () => {
    resultQuery.gte.mockResolvedValueOnce({ count: null, error: { code: "DB_ERROR" } });
    await expect(loadPublicStats()).rejects.toThrow("public_count_unavailable");
  });
});
