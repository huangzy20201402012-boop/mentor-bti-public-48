export * from "./schemas";
export { loadQuickContent } from "./quick-content";
export type { QuickBtiContent } from "./quick-content";

import { loadQuickContent } from "./quick-content";

/** The public edition contains only the 48-question experience. */
export const btiContent = loadQuickContent();
