import type { TestKind, TestSession } from "@mentor-bti/bti-core";

/**
 * Test-kind-parameterized localStorage session persistence with a resume guard.
 * The guard mirrors the one historically inlined in QuickTestExperience: a stored
 * session is only restored when schema, kind, content version, status and current
 * question all match the live test definition, so a stale bank never resumes a
 * mismatched run.
 */

export function testSessionKey(test: TestKind, ownerId?: string): string {
  // Quick-test progress belongs to one signed-in account. Never restore an
  // earlier anonymous run or another account's draft on a shared browser.
  return test === "quick" && ownerId
    ? `mentor-bti:${test}-session:${ownerId}`
    : `mentor-bti:${test}-session`;
}

export interface RestoreSessionInput {
  test: TestKind;
  contentVersion: string;
  knownQuestionIds: ReadonlySet<string>;
  ownerId?: string;
  /** Defaults to false so a finished quick-test session can resume safely. */
  includeCompleted?: boolean;
}

export function restoreTestSession(input: RestoreSessionInput): TestSession | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(testSessionKey(input.test, input.ownerId));
  } catch {
    // Private browsing or a restrictive browser must not prevent a test.
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TestSession;
    const hasValidAnswers = parsed.answers && typeof parsed.answers === "object" && !Array.isArray(parsed.answers);
    const hasKnownQuestion = input.knownQuestionIds.has(parsed.currentQuestionId);
    const statusOk = parsed.status === "in_progress" || (input.includeCompleted === true && parsed.status === "completed");
    if (parsed.schemaVersion === 1 && parsed.test === input.test && parsed.contentVersion === input.contentVersion && statusOk && hasValidAnswers && hasKnownQuestion) {
      return parsed;
    }
  } catch {
    // Malformed JSON is treated as no session.
  }
  return null;
}

export function saveTestSession(session: TestSession, ownerId?: string): void {
  try {
    window.localStorage.setItem(testSessionKey(session.test, ownerId), JSON.stringify(session));
  } catch {
    // Continue with the in-memory session when persistence is unavailable.
  }
}

export function clearTestSession(test: TestKind, ownerId?: string): void {
  try {
    window.localStorage.removeItem(testSessionKey(test, ownerId));
  } catch {
    // Nothing to clear.
  }
}
