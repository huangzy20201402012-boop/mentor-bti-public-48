import { completeTestRunInputSchema } from "../../../../../lib/analytics/contracts";
import { forbiddenResponse, isSameOriginRequest, rateLimitedResponse, readJson, takeRateLimit } from "../../../../../lib/analytics/server";
import { findOwnedTestRun, touchAnonymousSession } from "../../../../../lib/data/server";
import { getSupabaseServiceClient } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!isSameOriginRequest(request)) return forbiddenResponse();
  const parsed = completeTestRunInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 400 });
  if (!takeRateLimit("complete-test-run", `${parsed.data.sessionId}:${id}`, 6, 24 * 60 * 60 * 1000)) return rateLimitedResponse();
  const supabase = getSupabaseServiceClient();
  if (!supabase) return new Response(null, { status: 503 });
  const run = await findOwnedTestRun(supabase, id, parsed.data.sessionId);
  if (run.error) return new Response(null, { status: 503 });
  if (!run.data) return new Response(null, { status: 404 });

  const now = new Date().toISOString();
  const { error: resultError } = await supabase.from("anonymous_results").upsert({
    session_id: parsed.data.sessionId, test_run_id: id, result_key: parsed.data.resultKey,
    type_code: parsed.data.typeCode, domain_code: parsed.data.domainCode,
    axis_em: parsed.data.axisEm, axis_dn: parsed.data.axisDn, axis_sf: parsed.data.axisSf, axis_co: parsed.data.axisCo,
    confidence_level: parsed.data.confidenceLevel, boundary_axes: parsed.data.boundaryAxes,
    questionnaire_version: run.data.questionnaire_version, scoring_version: run.data.scoring_version,
    content_version: run.data.content_version
  }, { onConflict: "session_id,result_key" });
  if (resultError) return new Response(null, { status: 503 });
  const { error: runError } = await supabase.from("test_runs").update({
    status: "completed", last_activity_at: now, completed_at: now, result_key: parsed.data.resultKey,
    final_type_code: parsed.data.typeCode, final_domain_code: parsed.data.domainCode,
    axis_em: parsed.data.axisEm, axis_dn: parsed.data.axisDn, axis_sf: parsed.data.axisSf, axis_co: parsed.data.axisCo,
    confidence_level: parsed.data.confidenceLevel, boundary_axes: parsed.data.boundaryAxes
  }).eq("id", id);
  if (runError) return new Response(null, { status: 503 });
  await touchAnonymousSession(supabase, parsed.data.sessionId);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
