import { feedbackContactInputSchema } from "../../../lib/analytics/contracts";
import { forbiddenResponse, isSameOriginRequest, rateLimitedResponse, readJson, takeRateLimit } from "../../../lib/analytics/server";
import { touchAnonymousSession } from "../../../lib/data/server";
import { getAuthUser } from "../../../lib/supabase/auth-server";
import { getSupabaseServiceClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return forbiddenResponse();
  if (!(await getAuthUser())) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  const parsed = feedbackContactInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return new Response(null, { status: 400 });
  if (!takeRateLimit("feedback-contact", parsed.data.sessionId, 3, 24 * 60 * 60 * 1000)) return rateLimitedResponse();
  const supabase = getSupabaseServiceClient();
  if (!supabase) return new Response(null, { status: 503 });
  const { data: feedback, error: feedbackError } = await supabase.from("feedback").select("id")
    .eq("id", parsed.data.feedbackId).eq("session_id", parsed.data.sessionId).maybeSingle();
  if (feedbackError) return new Response(null, { status: 503 });
  if (!feedback) return new Response(null, { status: 404 });

  const now = new Date().toISOString();
  const { data: consent, error: consentError } = await supabase.from("consent_records").insert({
    anonymous_session_id: parsed.data.sessionId, consent_type: "contact_permission", granted: true,
    privacy_version: parsed.data.privacyVersion, consented_at: now, source: "web"
  }).select("id").single();
  if (consentError) return new Response(null, { status: 503 });
  const { error } = await supabase.from("feedback_contacts").upsert({
    anonymous_session_id: parsed.data.sessionId, feedback_id: feedback.id,
    email: parsed.data.email.trim().toLowerCase(), contact_consent: true,
    privacy_version: parsed.data.privacyVersion, consent_record_id: consent.id
  }, { onConflict: "feedback_id" });
  if (error) return new Response(null, { status: 503 });
  await touchAnonymousSession(supabase, parsed.data.sessionId);
  return Response.json({ feedbackId: feedback.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
