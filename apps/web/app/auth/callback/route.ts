import type { NextRequest } from "next/server";
import { createSupabaseAuthServerClient } from "../../../lib/supabase/auth-server";

/** Exchanges the one-use PKCE code from a Supabase email link for session cookies. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseAuthServerClient();
    if (supabase) {
      try {
        const flowId = request.nextUrl.searchParams.get("sb_flow_id");
        const { error } = await supabase.auth.exchangeCodeForSession(
          code,
          flowId ? { flowId } : undefined
        );
        if (!error) return new Response(null, {
          status: 303,
          headers: { Location: "/account", "Cache-Control": "no-store" }
        });
      } catch {
        // An expired or already-used link goes to the same actionable error page.
      }
    }
  }
  return new Response(null, {
    status: 303,
    headers: { Location: "/account?auth_error=link_invalid", "Cache-Control": "no-store" }
  });
}
