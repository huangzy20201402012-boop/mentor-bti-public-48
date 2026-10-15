import { anonymousSessionInputSchema } from "../../../../lib/analytics/contracts";
import { forbiddenResponse, isSameOriginRequest, noContentResponse, rateLimitedResponse, readJson, requestRateKey, takeRateLimit } from "../../../../lib/analytics/server";
import { getSupabaseServiceClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginRequest(request)) return forbiddenResponse();
  if (!takeRateLimit("session", requestRateKey(request), 20, 60 * 60 * 1000)) return rateLimitedResponse();

  const parsed = anonymousSessionInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return new Response(null, { status: 400 });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return noContentResponse();

  const id = crypto.randomUUID();
  const { error } = await supabase.from("anonymous_sessions").insert({
    id,
    entry_path: parsed.data.entryPath,
    entry_referrer: parsed.data.entryReferrer ?? null,
    client_type: parsed.data.clientType,
    utm_source: parsed.data.utmSource ?? null,
    utm_medium: parsed.data.utmMedium ?? null,
    utm_campaign: parsed.data.utmCampaign ?? null,
    privacy_version: parsed.data.privacyVersion ?? null
  });
  if (error) return new Response(null, { status: 503 });

  return Response.json({ sessionId: id }, { headers: { "Cache-Control": "no-store" } });
}
