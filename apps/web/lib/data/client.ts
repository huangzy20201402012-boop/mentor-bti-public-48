"use client";

import { getOrCreateAnonymousSession, isAnonymousAnalyticsAllowed } from "../analytics/client";
import {
  PRIVACY_VERSION,
  QUICK_QUESTIONNAIRE_VERSION,
  QUICK_SCORING_VERSION
} from "../analytics/version";

export type DataWriteStatus = "submitted" | "unavailable" | "failed" | "forbidden";

async function postJson(path: string, body: unknown): Promise<{ status: DataWriteStatus; payload: Record<string, unknown> | null }> {
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true
    });
    if (response.status === 403) return { status: "forbidden", payload: null };
    if (!response.ok) return { status: response.status === 503 ? "unavailable" : "failed", payload: null };
    if (response.status === 204) return { status: "submitted", payload: null };
    return { status: "submitted", payload: await response.json() as Record<string, unknown> };
  } catch {
    return { status: "unavailable", payload: null };
  }
}

export async function recordResearchConsent(granted: boolean): Promise<DataWriteStatus> {
  const sessionId = await getOrCreateAnonymousSession();
  if (!sessionId) return "unavailable";
  return (await postJson("/api/consents", {
    sessionId, consentType: "anonymous_research", granted, privacyVersion: PRIVACY_VERSION
  })).status;
}

export async function createQuickTestRun(contentVersion: string): Promise<{ status: DataWriteStatus; testRunId?: string; researchConsent?: boolean }> {
  const sessionId = await getOrCreateAnonymousSession();
  if (!sessionId) return { status: "unavailable" };
  const response = await postJson("/api/test-runs", {
    sessionId,
    questionnaireVersion: QUICK_QUESTIONNAIRE_VERSION,
    scoringVersion: QUICK_SCORING_VERSION,
    contentVersion,
    privacyVersion: PRIVACY_VERSION
  });
  return typeof response.payload?.testRunId === "string"
    ? { status: response.status, testRunId: response.payload.testRunId, researchConsent: response.payload.researchConsent === true }
    : { status: response.status };
}

/**
 * Starts remote collection in the background. The caller must never await this
 * before allowing the local 48-item test to render. A positive research choice
 * is persisted before the run is created, preventing a consent/write race.
 */
export async function beginQuickTestRun(contentVersion: string, researchConsent: boolean): Promise<{ status: DataWriteStatus; testRunId?: string; researchConsent?: boolean }> {
  if (!researchConsent && !isAnonymousAnalyticsAllowed()) return { status: "unavailable" };
  const consentStatus = await recordResearchConsent(researchConsent);
  if (consentStatus !== "submitted") return { status: consentStatus };
  return createQuickTestRun(contentVersion);
}

export async function saveQuickTestAnswers(testRunId: string, answers: Array<{ questionId: string; optionId: string; responseTimeMs?: number }>): Promise<DataWriteStatus> {
  const sessionId = await getOrCreateAnonymousSession();
  if (!sessionId) return "unavailable";
  return (await postJson(`/api/test-runs/${testRunId}/answers`, { sessionId, answers })).status;
}

export async function completeQuickTestRun(testRunId: string, result: {
  resultKey: string; typeCode: string; domainCode: string; axisEm: number; axisDn: number;
  axisSf: number; axisCo: number; confidenceLevel: number; boundaryAxes: string[];
}): Promise<DataWriteStatus> {
  const sessionId = await getOrCreateAnonymousSession();
  if (!sessionId) return "unavailable";
  return (await postJson(`/api/test-runs/${testRunId}/complete`, { sessionId, ...result })).status;
}
