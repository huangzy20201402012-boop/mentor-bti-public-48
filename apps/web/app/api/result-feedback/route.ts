import { resultFeedbackInputSchema } from "../../../lib/analytics/contracts";
import { forbiddenResponse, isSameOriginRequest, rateLimitedResponse, readJson, takeRateLimit } from "../../../lib/analytics/server";
import { findOwnedTestRun } from "../../../lib/data/server";
import { getAuthUser } from "../../../lib/supabase/auth-server";
import { getSupabaseServiceClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return forbiddenResponse();
  if (!(await getAuthUser())) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  const parsed = resultFeedbackInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return new Response(null, { status: 400 });
  if (!takeRateLimit("result-feedback", parsed.data.sessionId, 3, 24 * 60 * 60 * 1000)) return rateLimitedResponse();

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    console.error("result-feedback: Supabase service client unavailable", {
      hasUrl: Boolean(process.env.SUPABASE_URL),
      hasSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
    });
    return new Response(null, { status: 503 });
  }
  if (parsed.data.testRunId) {
    const run = await findOwnedTestRun(supabase, parsed.data.testRunId, parsed.data.sessionId);
    if (run.error) {
      console.error("result-feedback: test-run lookup failed", {
        name: run.error.name,
        code: run.error.code,
        message: run.error.message.slice(0, 160)
      });
      return new Response(null, { status: 503 });
    }
    if (!run.data) return new Response(null, { status: 404 });
  }

  const { data, error } = await supabase.from("result_feedback").insert({
    session_id: parsed.data.sessionId,
    result_key: parsed.data.resultKey,
    type_code: parsed.data.typeCode,
    domain_code: parsed.data.domainCode,
    accuracy_rating: parsed.data.accuracyRating,
    reason_tags: parsed.data.reasonTags,
    comment: parsed.data.comment || null,
    test_run_id: parsed.data.testRunId ?? null,
    questionnaire_version: parsed.data.questionnaireVersion ?? null,
    scoring_version: parsed.data.scoringVersion ?? null
  }).select("id").single();
  if (error) {
    console.error("result-feedback: insert failed", { code: error.code });
    return new Response(null, { status: 503 });
  }

  return Response.json({ resultFeedbackId: data.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
