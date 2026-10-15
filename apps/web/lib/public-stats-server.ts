import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceClient } from "./supabase/server";
import { publicStatsStartAt, type PublicStatsSnapshot } from "./public-stats";

const AUTH_PAGE_SIZE = 1000;
const MAX_AUTH_PAGES = 100;

async function countRegisteredAccounts(supabase: SupabaseClient): Promise<number> {
  let count = 0;
  for (let page = 1; page <= MAX_AUTH_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE });
    if (error || !data) throw new Error("auth_count_unavailable");
    const users = data.users;
    count += users.length;
    const nextPage = "nextPage" in data && typeof data.nextPage === "number" ? data.nextPage : null;
    if (!nextPage || users.length < AUTH_PAGE_SIZE) return count;
  }
  // Never silently undercount a large audience. Move to an aggregate DB query
  // before this beta-scale threshold is reached.
  throw new Error("auth_count_page_limit");
}

export async function loadPublicStats(): Promise<PublicStatsSnapshot> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("supabase_unavailable");
  const startedAt = publicStatsStartAt(process.env.PUBLIC_METRICS_START_AT);

  const [views, results, registeredAccounts] = await Promise.all([
    supabase.from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_name", "page_view")
      .gte("created_at", startedAt),
    supabase.from("quick_results")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startedAt),
    countRegisteredAccounts(supabase)
  ]);

  if (views.error || results.error || views.count === null || results.count === null) {
    throw new Error("public_count_unavailable");
  }

  return {
    startedAt,
    pageViews: views.count,
    registeredAccounts,
    completedTests: results.count
  };
}
