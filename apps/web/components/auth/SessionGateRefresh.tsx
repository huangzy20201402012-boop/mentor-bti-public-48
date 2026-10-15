"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser";

const RETRY_INTERVAL_MS = 30_000;

/**
 * A browser may still have a renewable session after an SSR request sees an
 * expired access token. The browser client can write refreshed cookies; then
 * the protected Server Component gets one new request to verify them.
 *
 * This does not grant access locally. Only the server route decides whether to
 * render a test or result. The short throttle prevents a refresh loop when the
 * auth service or cookies are unavailable on a particular browser.
 */
export function SessionGateRefresh() {
  const router = useRouter();

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;

    const retryKey = `mentor-bti:auth-gate-refresh:${window.location.pathname}`;
    try {
      const lastAttempt = Number(window.sessionStorage.getItem(retryKey) ?? 0);
      if (Date.now() - lastAttempt < RETRY_INTERVAL_MS) return;
    } catch { /* A restricted browser can still try once per mount. */ }

    let active = true;
    void client.auth.getClaims().then(({ data, error }) => {
      const claims = data?.claims as { sub?: unknown } | undefined;
      if (!active || error || typeof claims?.sub !== "string") return;
      try { window.sessionStorage.setItem(retryKey, String(Date.now())); } catch { /* still refresh */ }
      router.refresh();
    }).catch(() => { /* Stay on the login gate; the user can sign in normally. */ });

    return () => { active = false; };
  }, [router]);

  return null;
}
