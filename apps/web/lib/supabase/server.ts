import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null | undefined;

/**
 * Returns a server-only client. Absence of configuration is an expected local
 * development state, not an application error: the product must still work.
 */
export function getSupabaseServiceClient(): SupabaseClient | null {
  if (serviceClient !== undefined) return serviceClient;

  const url = process.env.SUPABASE_URL;
  // Prefer Supabase's current secret key; keep the legacy service_role key as
  // a fallback for existing deployments. Both must remain server-only.
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) {
    serviceClient = null;
    return serviceClient;
  }

  try {
    serviceClient = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
    });
  } catch {
    serviceClient = null;
  }
  return serviceClient;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseServiceClient() !== null;
}
