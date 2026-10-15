/** The public counter starts with this rollout, not the earlier internal tests. */
export const DEFAULT_PUBLIC_STATS_START_AT = "2026-10-14T03:42:30.000Z";

export interface PublicStatsSnapshot {
  startedAt: string;
  pageViews: number;
  registeredAccounts: number;
  completedTests: number;
}

/** Account, counter-explanation and infrastructure pages do not increase reach. */
export function isCountedPagePath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return false;
  return !["/account", "/metrics", "/admin", "/api"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function publicStatsStartAt(raw: string | undefined): string {
  if (!raw) return DEFAULT_PUBLIC_STATS_START_AT;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? DEFAULT_PUBLIC_STATS_START_AT : parsed.toISOString();
}
