import "server-only";

import { btiContent } from "@mentor-bti/bti-content";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function findOwnedTestRun(supabase: SupabaseClient, testRunId: string, sessionId: string) {
  const { data, error } = await supabase
    .from("test_runs")
    .select("id, anonymous_session_id, questionnaire_version, scoring_version, content_version, privacy_version, research_consent")
    .eq("id", testRunId)
    .eq("anonymous_session_id", sessionId)
    .maybeSingle();
  return { data, error };
}

export async function hasActiveResearchConsent(supabase: SupabaseClient, sessionId: string, privacyVersion: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("consent_records")
    .select("granted, revoked_at")
    .eq("anonymous_session_id", sessionId)
    .eq("consent_type", "anonymous_research")
    .eq("privacy_version", privacyVersion)
    .order("consented_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return !error && Boolean(data?.granted && !data.revoked_at);
}

export function resolveQuickAnswer(questionId: string, optionId: string): { optionId: string; isNa: boolean; numericValue: number | null } | null {
  const question = btiContent.quickTest.questions.find((item) => item.id === questionId);
  if (!question) return null;
  if (optionId === "na") return question.naAllowed ? { optionId, isNa: true, numericValue: null } : null;
  const option = question.options.find((item) => item.id === optionId);
  return option ? { optionId, isNa: false, numericValue: option.value } : null;
}

export async function touchAnonymousSession(supabase: SupabaseClient, sessionId: string): Promise<void> {
  await supabase.from("anonymous_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", sessionId);
}
