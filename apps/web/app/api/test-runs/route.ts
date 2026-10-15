import { createTestRunInputSchema } from "../../../lib/analytics/contracts";
import { forbiddenResponse, isSameOriginRequest, rateLimitedResponse, readJson, takeRateLimit } from "../../../lib/analytics/server";
import { hasActiveResearchConsent, touchAnonymousSession } from "../../../lib/data/server";
import { getSupabaseServiceClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return forbiddenResponse();
  const parsed = createTestRunInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return new Response(null, { status: 400 });
  if (!takeRateLimit("test-run", parsed.data.sessionId, 12, 24 * 60 * 60 * 1000)) return rateLimitedResponse();
  const supabase = getSupabaseServiceClient();
  if (!supabase) return new Response(null, { status: 503 });

  const researchConsent = await hasActiveResearchConsent(supabase, parsed.data.sessionId, parsed.data.privacyVersion);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error } = await supabase.from("test_runs").insert({
    id, anonymous_session_id: parsed.data.sessionId, test_kind: "quick", status: "started",
    questionnaire_version: parsed.data.questionnaireVersion, scoring_version: parsed.data.scoringVersion,
    content_version: parsed.data.contentVersion, privacy_version: parsed.data.privacyVersion,
    research_consent: researchConsent, started_at: now, last_activity_at: now
  });
  if (error) return new Response(null, { status: 503 });
  await touchAnonymousSession(supabase, parsed.data.sessionId);
  return Response.json({ testRunId: id, researchConsent }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
