"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side auth client.
 *
 * Uses the publishable key, which is safe to ship: every table it reaches is
 * fenced by row-level security keyed on the signed-in user. An unconfigured
 * site can still render public pages and login gates, so absence returns null.
 */
let browserClient: SupabaseClient | null | undefined;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient !== undefined) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    browserClient = null;
    return browserClient;
  }

  try {
    browserClient = createBrowserClient(url, publishableKey);
  } catch {
    browserClient = null;
  }
  return browserClient;
}

export function isSupabaseAuthConfigured(): boolean {
  return getSupabaseBrowserClient() !== null;
}
