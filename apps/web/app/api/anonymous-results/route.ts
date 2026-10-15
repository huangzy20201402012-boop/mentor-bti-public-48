import { anonymousResultInputSchema } from "../../../lib/analytics/contracts";
import { forbiddenResponse, isSameOriginRequest, noContentResponse, rateLimitedResponse, readJson, takeRateLimit } from "../../../lib/analytics/server";
import { findOwnedTestRun } from "../../../lib/data/server";
import { getSupabaseServiceClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return forbiddenResponse();
  const parsed = anonymousResultInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return new Response(null, { status: 400 });
  if (!takeRateLimit("result", parsed.data.sessionId, 10, 24 * 60 * 60 * 1000)) return rateLimitedResponse();

  const supabase = getSupabaseServiceClient();
  if (!supabase) return noContentResponse();
  if (parsed.data.testRunId) {
    const run = await findOwnedTestRun(supabase, parsed.data.testRunId, parsed.data.sessionId);
    if (run.error) return new Response(null, { status: 503 });
    if (!run.data) return new Response(null, { status: 404 });
  }

  const { error } = await supabase.from("anonymous_results").upsert({
    session_id: parsed.data.sessionId,
    test_run_id: parsed.data.testRunId ?? null,
    result_key: parsed.data.resultKey,
    type_code: parsed.data.typeCode,
    domain_code: parsed.data.domainCode,
    axis_em: parsed.data.axisEm,
    axis_dn: parsed.data.axisDn,
    axis_sf: parsed.data.axisSf,
    axis_co: parsed.data.axisCo,
    confidence_level: parsed.data.confidenceLevel,
    boundary_axes: parsed.data.boundaryAxes,
    questionnaire_version: parsed.data.questionnaireVersion ?? null,
    scoring_version: parsed.data.scoringVersion,
    content_version: parsed.data.contentVersion
  }, { onConflict: "session_id,result_key" });
  if (error) return new Response(null, { status: 503 });

  return noContentResponse();
}
