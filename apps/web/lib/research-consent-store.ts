/**
 * Per-test intent for the optional anonymous-research contribution.
 *
 * Deliberately sessionStorage rather than a cookie or localStorage: a new tab
 * or a later visit must ask again, and closing the tab drops the choice. This
 * value is only an *intent* — the authorization that actually gates answer
 * writes lives in `consent_records` on the server and is re-read on every
 * write, so nothing here is trusted.
 */
const CONSENT_INTENT_KEY = "mentor-bti:research-consent-intent:v1";

export function rememberResearchConsentIntent(granted: boolean): void {
  try {
    window.sessionStorage.setItem(CONSENT_INTENT_KEY, granted ? "granted" : "declined");
  } catch {
    // Storage unavailable: the next page reads "not granted", which is the safe default.
  }
}

/** Absent, unreadable or malformed state all mean "not granted". */
export function readResearchConsentIntent(): boolean {
  try {
    return window.sessionStorage.getItem(CONSENT_INTENT_KEY) === "granted";
  } catch {
    return false;
  }
}
