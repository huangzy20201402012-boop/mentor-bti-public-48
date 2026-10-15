import { analyticsEventInputSchema } from "../../../../lib/analytics/contracts";
import { forbiddenResponse, isSameOriginRequest, noContentResponse, rateLimitedResponse, readJson, takeRateLimit } from "../../../../lib/analytics/server";
import { findOwnedTestRun } from "../../../../lib/data/server";
import { getSupabaseServiceClient } from "../../../../lib/supabase/server";
import { isCountedPagePath } from "../../../../lib/public-stats";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return forbiddenResponse();
  const parsed = analyticsEventInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return new Response(null, { status: 400 });
  if (parsed.data.eventName === "page_view" && !isCountedPagePath(parsed.data.pagePath)) return noContentResponse();
  if (!takeRateLimit("event", parsed.data.sessionId, 240, 60 * 60 * 1000)) return rateLimitedResponse();

  const supabase = getSupabaseServiceClient();
  if (!supabase) return noContentResponse();
  if (parsed.data.testRunId) {
    const run = await findOwnedTestRun(supabase, parsed.data.testRunId, parsed.data.sessionId);
    if (run.error) return new Response(null, { status: 503 });
    if (!run.data) return new Response(null, { status: 404 });
  }

  const { error } = await supabase.from("analytics_events").insert({
    session_id: parsed.data.sessionId,
    event_name: parsed.data.eventName,
    page_path: parsed.data.pagePath,
    question_index: parsed.data.questionIndex ?? null,
    question_id: parsed.data.questionId ?? null,
    test_run_id: parsed.data.testRunId ?? null,
    type_code: parsed.data.typeCode ?? null,
    domain_code: parsed.data.domainCode ?? null,
    metadata: parsed.data.metadata
  });
  if (error) return new Response(null, { status: 503 });

  await supabase.from("anonymous_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", parsed.data.sessionId);
  return noContentResponse();
}
