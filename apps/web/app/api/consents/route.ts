import { consentInputSchema } from "../../../lib/analytics/contracts";
import { forbiddenResponse, isSameOriginRequest, rateLimitedResponse, readJson, takeRateLimit } from "../../../lib/analytics/server";
import { touchAnonymousSession } from "../../../lib/data/server";
import { getSupabaseServiceClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return forbiddenResponse();
  const parsed = consentInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return new Response(null, { status: 400 });
  if (!takeRateLimit("consent", parsed.data.sessionId, 16, 24 * 60 * 60 * 1000)) return rateLimitedResponse();
  const supabase = getSupabaseServiceClient();
  if (!supabase) return new Response(null, { status: 503 });

  const consentedAt = new Date().toISOString();
  const { data, error } = await supabase.from("consent_records").insert({
    anonymous_session_id: parsed.data.sessionId,
    consent_type: parsed.data.consentType,
    granted: parsed.data.granted,
    privacy_version: parsed.data.privacyVersion,
    consented_at: consentedAt,
    revoked_at: parsed.data.granted ? null : consentedAt,
    source: "web"
  }).select("id").single();
  if (error) return new Response(null, { status: 503 });
  await touchAnonymousSession(supabase, parsed.data.sessionId);
  return Response.json({ consentId: data.id }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
