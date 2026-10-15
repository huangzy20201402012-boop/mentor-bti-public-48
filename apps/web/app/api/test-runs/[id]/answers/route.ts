import { saveTestAnswersInputSchema } from "../../../../../lib/analytics/contracts";
import { forbiddenResponse, isSameOriginRequest, rateLimitedResponse, readJson, takeRateLimit } from "../../../../../lib/analytics/server";
import { findOwnedTestRun, hasActiveResearchConsent, resolveQuickAnswer, touchAnonymousSession } from "../../../../../lib/data/server";
import { getSupabaseServiceClient } from "../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!isSameOriginRequest(request)) return forbiddenResponse();
  const parsed = saveTestAnswersInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 400 });
  if (!takeRateLimit("test-answers", `${parsed.data.sessionId}:${id}`, 36, 60 * 60 * 1000)) return rateLimitedResponse();
  const supabase = getSupabaseServiceClient();
  if (!supabase) return new Response(null, { status: 503 });
  const run = await findOwnedTestRun(supabase, id, parsed.data.sessionId);
  if (run.error) return new Response(null, { status: 503 });
  if (!run.data) return new Response(null, { status: 404 });
  const ownedRun = run.data;
  if (!await hasActiveResearchConsent(supabase, parsed.data.sessionId, ownedRun.privacy_version)) return new Response(null, { status: 403 });

  const now = new Date().toISOString();
  const answers: Array<{
    test_run_id: string; question_id: string; option_id: string; numeric_value: number | null;
    is_na: boolean; response_time_ms: number | null; answered_at: string; questionnaire_version: string;
  }> = [];
  for (const answer of parsed.data.answers) {
    const resolved = resolveQuickAnswer(answer.questionId, answer.optionId);
    if (!resolved) return new Response(null, { status: 400 });
    answers.push({
      test_run_id: id, question_id: answer.questionId, option_id: resolved.optionId,
      numeric_value: resolved.numericValue, is_na: resolved.isNa,
      response_time_ms: answer.responseTimeMs ?? null, answered_at: now,
      questionnaire_version: ownedRun.questionnaire_version
    });
  }
  const { error } = await supabase.from("test_answers").upsert(answers, { onConflict: "test_run_id,question_id" });
  if (error) return new Response(null, { status: 503 });
  await supabase.from("test_runs").update({ status: "in_progress", last_activity_at: now }).eq("id", id);
  await touchAnonymousSession(supabase, parsed.data.sessionId);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
