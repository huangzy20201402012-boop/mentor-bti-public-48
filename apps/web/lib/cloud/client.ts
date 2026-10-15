"use client";

import { getSupabaseBrowserClient } from "../supabase/browser";
import {
  fetchOwnQuickResults as fetchOwnQuickResultsWith,
  type AccountResultsSnapshot
} from "./account-results";
import { submitFeedbackToCloud, type FeedbackSubmitOutcome } from "./feedback-submissions";
import { createQuickResultSaver, type CloudSaveOutcome, type QuickResultPayload } from "./quick-results";
import { fetchOwnCloudQuickResult } from "./result-lookup";

/**
 * Binds the tested pure modules to the real browser client.
 *
 * This file is deliberately thin and holds no decisions: every branch that
 * matters (未登录不写、出错不抛、脏数据不穿透) lives in the pure modules and is
 * covered by tests. Keeping the wiring trivial is what keeps that coverage
 * meaningful — there is nothing here that could be wrong in a way the tests
 * would not have caught.
 */

/**
 * Resolves the signed-in user id from verified claims.
 *
 * `getClaims()` verifies the signature instead of trusting the cookie's decoded
 * payload, and every failure — unconfigured, offline, expired, tampered —
 * collapses to null, i.e. "signed out".
 */
export async function getSignedInUserId(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error) return null;
    const claims = data?.claims as { sub?: unknown } | undefined;
    const id = claims?.sub;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * Saves a finished 48-item result to the signed-in user's account.
 *
 * The caller waits for a successful save before opening the protected result
 * page. A changed or expired session must never claim another account's draft.
 */
export async function saveQuickResultToCloud(input: {
  resultKey: string;
  result: QuickResultPayload;
  expectedOwnerId?: string;
}): Promise<CloudSaveOutcome> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "skipped";

  const ownerId = await getSignedInUserId();
  if (!ownerId) return "skipped";
  if (input.expectedOwnerId && input.expectedOwnerId !== ownerId) return "skipped";

  const save = createQuickResultSaver({
    // Already resolved above; re-reading it here would only add a second,
    // independently failing round trip.
    isSignedIn: async () => true,
    // A browser refresh mounts the result page again. Ignoring an existing
    // (owner_id, result_key) row makes this retry idempotent instead of
    // showing a false "sync failed" notice after a successful first save.
    insert: (row) => supabase.from("quick_results").upsert(row, {
      onConflict: "owner_id,result_key",
      ignoreDuplicates: true
    })
  });
  return save({ ...input, ownerId });
}

/** Submits account feedback. Validation runs before any network or session read. */
export async function submitAccountFeedback(input: {
  category: string;
  message: string;
}): Promise<{ status: FeedbackSubmitOutcome; errorCode: string | null }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { status: "skipped", errorCode: null };

  const ownerId = await getSignedInUserId();
  if (!ownerId) return { status: "skipped", errorCode: null };

  let errorCode: string | null = null;
  const status = await submitFeedbackToCloud(
    {
      isSignedIn: async () => true,
      insert: (row) => supabase.from("feedback_submissions").insert(row),
      onError: (error) => {
        const code = error && typeof error === "object" && "code" in error ? error.code : null;
        errorCode = typeof code === "string" && /^[A-Z0-9]{3,12}$/.test(code) ? code : "NETWORK";
        console.error("Account feedback submission failed", { code: errorCode });
      }
    },
    { ownerId, ...input }
  );
  return { status, errorCode };
}

/**
 * Fallback for a result this browser no longer has: reads the signed-in user's
 * own copy from their account. Returns null for anyone not signed in, so the
 * caller keeps its existing "not saved on this device" state unchanged.
 */
export async function fetchOwnCloudResult<TPayload extends QuickResultPayload>(input: {
  resultKey: string;
  contentVersion: string;
}): Promise<TPayload | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  return fetchOwnCloudQuickResult<TPayload>(
    {
      currentUserId: getSignedInUserId,
      findOwn: (ownerId, resultKey) =>
        supabase
          .from("quick_results")
          .select("content_version, result_payload")
          .eq("owner_id", ownerId)
          .eq("result_key", resultKey)
          .limit(1)
    },
    input
  );
}

/**
 * Reads the signed-in user's own 48-item history, newest first.
 *
 * Returns the outcome alongside the rows so the page can tell "no records" apart
 * from "could not read" — the two need different sentences, and only one of them
 * is a reason to send the user off to take the test.
 */
export async function fetchOwnQuickResults(): Promise<AccountResultsSnapshot> {
  const supabase = getSupabaseBrowserClient();
  // Unconfigured is "could not read", not "you have nothing".
  if (!supabase) return { outcome: "unavailable", results: [] };

  return fetchOwnQuickResultsWith({
    currentUserId: getSignedInUserId,
    list: (ownerId) =>
      supabase
        .from("quick_results")
        .select("id, result_key, content_version, created_at, result_payload")
        // RLS already scopes this to the caller; the explicit filter makes the
        // same guarantee visible in the request itself.
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(50)
  });
}
