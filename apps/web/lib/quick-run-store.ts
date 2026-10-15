/**
 * Maps a result key to the anonymous test run created for it, so the result
 * page can attach its feedback and completion summary to the same run instead
 * of orphaning them. Session-scoped on purpose: a run belongs to the visit that
 * created it, and a missing entry simply means "no remote run" — callers must
 * always have a local fallback.
 */
const RUN_KEY_PREFIX = "mentor-bti:quick-run:";
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

export interface QuickRunContext {
  testRunId: string;
  researchConsent: boolean;
}

export function rememberQuickRun(resultKey: string, context: QuickRunContext): void {
  try {
    window.sessionStorage.setItem(`${RUN_KEY_PREFIX}${resultKey}`, JSON.stringify(context));
  } catch {
    // Feedback then submits without a run id; every field it feeds is optional.
  }
}

export function getQuickRun(resultKey: string): QuickRunContext | null {
  try {
    const raw = window.sessionStorage.getItem(`${RUN_KEY_PREFIX}${resultKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QuickRunContext>;
    return typeof parsed.testRunId === "string" && UUID_PATTERN.test(parsed.testRunId)
      ? { testRunId: parsed.testRunId, researchConsent: parsed.researchConsent === true }
      : null;
  } catch {
    return null;
  }
}

/** Drops every remembered run. Called when a fresh test starts, so repeated runs in one tab cannot accumulate. */
export function clearQuickRuns(): void {
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(RUN_KEY_PREFIX)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Nothing to clear.
  }
}
