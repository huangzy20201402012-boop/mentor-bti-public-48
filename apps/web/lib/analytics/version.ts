/**
 * Version of the quick-result scoring semantics, independent from question-bank
 * contentVersion. Bump this when mappings, weights, normalization, thresholds,
 * or result aggregation change comparability across saved results.
 */
export const QUICK_SCORING_VERSION = "quick-v1.0";

/**
 * Stable labels for a V1.1 research record. `CONTENT_VERSION` deliberately
 * remains the content file version emitted by the scorer; it is not a second
 * scoring version.
 */
export const QUICK_QUESTIONNAIRE_VERSION = "quick-q-v1.0";
export const PRIVACY_VERSION = "privacy-v1.1";
