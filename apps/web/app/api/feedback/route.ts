import { feedbackInputSchema } from "../../../lib/analytics/contracts";
import { forbiddenResponse, isSameOriginRequest, rateLimitedResponse, readJson, takeRateLimit } from "../../../lib/analytics/server";
import { findOwnedTestRun } from "../../../lib/data/server";
import { getAuthUser } from "../../../lib/supabase/auth-server";
import { getSupabaseServiceClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return forbiddenResponse();
  if (!(await getAuthUser())) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  const parsed = feedbackInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return new Response(null, { status: 400 });
  if (!takeRateLimit("feedback", parsed.data.sessionId, 5, 24 * 60 * 60 * 1000)) return rateLimitedResponse();

  const supabase = getSupabaseServiceClient();
  if (!supabase) return new Response(null, { status: 503 });
  if (parsed.data.testRunId) {
    const run = await findOwnedTestRun(supabase, parsed.data.testRunId, parsed.data.sessionId);
    if (run.error) return new Response(null, { status: 503 });
    if (!run.data) return new Response(null, { status: 404 });
  }

  const { data, error } = await supabase.from("feedback").insert({
    session_id: parsed.data.sessionId,
    feedback_type: parsed.data.feedbackType,
    rating: parsed.data.rating ?? null,
    message: parsed.data.message || null,
    page_path: parsed.data.pagePath ?? null,
    question_id: parsed.data.questionId ?? null,
    type_code: parsed.data.typeCode ?? null,
    domain_code: parsed.data.domainCode ?? null,
    reason_code: parsed.data.reasonCode ?? null,
    test_run_id: parsed.data.testRunId ?? null,
    questionnaire_version: parsed.data.questionnaireVersion ?? null,
    scoring_version: parsed.data.scoringVersion ?? null
  }).select("id").single();
  if (error) return new Response(null, { status: 503 });

  return Response.json({ feedbackId: data.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
