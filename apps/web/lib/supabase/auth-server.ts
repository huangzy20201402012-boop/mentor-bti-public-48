import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function getSupabaseAuthConfig(): { url: string; publishableKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : null;
}

/**
 * Request-scoped auth client.
 *
 * A new client per request is required, not tidiness: @supabase/ssr delivers the
 * `Cache-Control: private, no-store` headers only with the first cookie write of
 * a given client, so a reused client would leave later responses cacheable and
 * let one user's session be served to another.
 *
 * Cookie writes from a Server Component throw (only Actions and Route Handlers
 * may set cookies). That is expected here and deliberately swallowed: `proxy.ts`
 * refreshes the session when a host supports it. A login gate also asks the
 * browser client to refresh cookies and re-request the page when possible.
 */
export async function createSupabaseAuthServerClient(): Promise<SupabaseClient | null> {
  const config = getSupabaseAuthConfig();
  if (!config) return null;

  const cookieStore = await cookies();
  try {
    return createServerClient(config.url, config.publishableKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
          } catch {
            // Rendering, not acting: proxy.ts refreshes the session on the way in.
          }
        }
      }
    });
  } catch {
    return null;
  }
}

export interface AuthUser {
  id: string;
  email: string | null;
}

/**
 * Resolves the signed-in user from verified claims.
 *
 * `getClaims()` verifies the JWT signature rather than trusting the cookie's
 * decoded payload, which is what makes it safe to act on. Anything that goes
 * wrong — unconfigured, offline, expired, tampered — collapses to "signed out":
 * the durable failure mode is a user who has to sign in again, never a request
 * that proceeds on an unverified identity.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error) return null;
    const claims = data?.claims as { sub?: unknown; email?: unknown } | undefined;
    const id = claims?.sub;
    if (typeof id !== "string" || id.length === 0) return null;
    return { id, email: typeof claims?.email === "string" ? claims.email : null };
  } catch {
    return null;
  }
}
