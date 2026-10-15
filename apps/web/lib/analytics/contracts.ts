import { z } from "zod";

export const EVENT_NAMES = [
  "page_view",
  "landing_view",
  "quick_test_intro_view",
  "quick_test_start",
  "quick_test_resume",
  "quick_test_question_reached",
  "quick_test_na_selected",
  "quick_test_complete",
  "quick_result_view",
  "type_detail_view",
  "domain_detail_view",
  "share_card_generate",
  "share_card_download",
  "share_to_peer_click",
  "referral_landing",
  "result_feedback_open",
  "result_feedback_submit",
  "general_feedback_submit",
  "question_feedback_submit",
  "save_result_prompt_view",
  "save_result_signup_click",
  "save_result_signup_complete"
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

const eventNameSchema = z.enum(EVENT_NAMES);
const sessionIdSchema = z.string().uuid();
const testRunIdSchema = z.string().uuid();
const pagePathSchema = z.string().max(200).regex(/^\//, "页面路径必须以 / 开始");
const questionIdSchema = z.string().regex(/^Q\d{3}$/).max(12);
const typeCodeSchema = z.string().regex(/^[EM][DN][SF][CO]$/);
const domainCodeSchema = z.enum(["ED", "EN", "MD", "MN"]);
const axisSchema = z.enum(["em", "dn", "sf", "co"]);
const shareMethodSchema = z.enum(["native", "copy"]);
const eventMetadataSchema = z.object({ shareMethod: shareMethodSchema.optional() }).strict().default({});
const questionnaireVersionSchema = z.string().regex(/^quick-q-v\d+\.\d+$/);
const scoringVersionSchema = z.string().regex(/^quick-v\d+\.\d+$/);
const contentVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const privacyVersionSchema = z.string().regex(/^privacy-v\d+\.\d+$/);

export const anonymousSessionInputSchema = z.object({
  entryPath: pagePathSchema,
  entryReferrer: z.string().max(255).optional(),
  clientType: z.enum(["mobile", "desktop", "tablet", "wechat_webview", "unknown"]),
  utmSource: z.string().max(128).optional(),
  utmMedium: z.string().max(128).optional(),
  utmCampaign: z.string().max(128).optional(),
  privacyVersion: privacyVersionSchema.optional()
}).strict();

export const analyticsEventInputSchema = z.object({
  sessionId: sessionIdSchema,
  eventName: eventNameSchema,
  pagePath: pagePathSchema,
  questionIndex: z.number().int().min(1).max(48).optional(),
  questionId: questionIdSchema.optional(),
  testRunId: testRunIdSchema.optional(),
  typeCode: typeCodeSchema.optional(),
  domainCode: domainCodeSchema.optional(),
  metadata: eventMetadataSchema
}).strict().superRefine((value, context) => {
  const isQuestionEvent = value.eventName === "quick_test_question_reached" || value.eventName === "quick_test_na_selected";
  if (isQuestionEvent && (value.questionIndex === undefined || value.questionId === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "题目事件必须包含题号与题目ID" });
  }
  if ((value.typeCode === undefined) !== (value.domainCode === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "类型与科研域必须同时出现" });
  }
  if (value.typeCode && value.domainCode && value.typeCode.slice(0, 2) !== value.domainCode) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "类型与科研域不匹配" });
  }
  if (value.eventName === "share_to_peer_click" && !value.metadata.shareMethod) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "分享事件必须标记原生分享或复制链接" });
  }
  if (value.eventName !== "share_to_peer_click" && value.metadata.shareMethod) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "只有分享事件可以包含分享方式" });
  }
});

export const anonymousResultInputSchema = z.object({
  sessionId: sessionIdSchema,
  resultKey: z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/),
  typeCode: typeCodeSchema,
  domainCode: domainCodeSchema,
  axisEm: z.number().min(0).max(100),
  axisDn: z.number().min(0).max(100),
  axisSf: z.number().min(0).max(100),
  axisCo: z.number().min(0).max(100),
  confidenceLevel: z.number().int().min(0).max(100),
  boundaryAxes: z.array(axisSchema).max(4),
  testRunId: testRunIdSchema.optional(),
  questionnaireVersion: questionnaireVersionSchema.optional(),
  scoringVersion: scoringVersionSchema,
  contentVersion: contentVersionSchema
}).strict().superRefine((value, context) => {
  if (value.typeCode.slice(0, 2) !== value.domainCode) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "类型与科研域不匹配" });
  }
});

export const FEEDBACK_TYPES = ["general", "question_unclear", "result_inaccurate", "result_accurate", "page_bug", "share_issue", "visual_issue", "suggestion", "other"] as const;
export const RESULT_FEEDBACK_REASONS = ["type_matches", "description_matches", "axis_matches", "details_resonate", "type_mismatch", "axis_mismatch", "description_mismatch", "questions_hard_to_answer", "advisor_changes_by_context", "not_enough_interaction", "other"] as const;
export const QUESTION_FEEDBACK_REASONS = ["not_experienced", "unclear_wording", "no_suitable_option", "context_varies", "other"] as const;

export const feedbackInputSchema = z.object({
  sessionId: sessionIdSchema,
  feedbackType: z.enum(FEEDBACK_TYPES),
  rating: z.number().int().min(1).max(5).optional(),
  message: z.string().trim().max(1000).optional(),
  pagePath: pagePathSchema.optional(),
  questionId: questionIdSchema.optional(),
  typeCode: typeCodeSchema.optional(),
  domainCode: domainCodeSchema.optional(),
  reasonCode: z.enum(QUESTION_FEEDBACK_REASONS).optional(),
  testRunId: testRunIdSchema.optional(),
  questionnaireVersion: questionnaireVersionSchema.optional(),
  scoringVersion: scoringVersionSchema.optional()
}).strict().superRefine((value, context) => {
  if (value.typeCode && value.domainCode && value.typeCode.slice(0, 2) !== value.domainCode) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "类型与科研域不匹配" });
  }
  if (value.feedbackType === "question_unclear" && (!value.questionId || !value.reasonCode)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "题目反馈必须包含题目ID和原因" });
  }
  if (value.feedbackType !== "question_unclear" && value.reasonCode) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "只有题目反馈可以包含题目原因" });
  }
  if (value.feedbackType !== "question_unclear" && !value.message) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "一般反馈必须包含文字说明" });
  }
});

export const resultFeedbackInputSchema = z.object({
  sessionId: sessionIdSchema,
  resultKey: z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/),
  typeCode: typeCodeSchema,
  domainCode: domainCodeSchema,
  accuracyRating: z.number().int().min(1).max(5),
  reasonTags: z.array(z.enum(RESULT_FEEDBACK_REASONS)).max(8),
  comment: z.string().trim().max(1000).optional(),
  testRunId: testRunIdSchema.optional(),
  questionnaireVersion: questionnaireVersionSchema.optional(),
  scoringVersion: scoringVersionSchema.optional()
}).strict().superRefine((value, context) => {
  if (value.typeCode.slice(0, 2) !== value.domainCode) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "类型与科研域不匹配" });
  }
});

export type FeedbackInput = z.input<typeof feedbackInputSchema>;
export type ResultFeedbackInput = z.input<typeof resultFeedbackInputSchema>;

export const CONSENT_TYPES = ["essential_operations", "anonymous_analytics", "anonymous_research", "contact_permission"] as const;

export const consentInputSchema = z.object({
  sessionId: sessionIdSchema,
  consentType: z.enum(CONSENT_TYPES),
  granted: z.boolean(),
  privacyVersion: privacyVersionSchema
}).strict();

export const createTestRunInputSchema = z.object({
  sessionId: sessionIdSchema,
  questionnaireVersion: questionnaireVersionSchema,
  scoringVersion: scoringVersionSchema,
  contentVersion: contentVersionSchema,
  privacyVersion: privacyVersionSchema
}).strict();

const testAnswerItemSchema = z.object({
  questionId: questionIdSchema,
  optionId: z.string().min(1).max(16).regex(/^[A-Za-z0-9_-]+$/),
  responseTimeMs: z.number().int().min(0).max(30 * 60 * 1000).optional()
}).strict();

export const saveTestAnswersInputSchema = z.object({
  sessionId: sessionIdSchema,
  answers: z.array(testAnswerItemSchema).min(1).max(48)
}).strict().superRefine((value, context) => {
  const questionIds = new Set<string>();
  for (const answer of value.answers) {
    if (questionIds.has(answer.questionId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "同一批答案不能重复题目" });
      return;
    }
    questionIds.add(answer.questionId);
  }
});

export const completeTestRunInputSchema = z.object({
  sessionId: sessionIdSchema,
  resultKey: z.string().min(1).max(96).regex(/^[A-Za-z0-9_-]+$/),
  typeCode: typeCodeSchema,
  domainCode: domainCodeSchema,
  axisEm: z.number().min(0).max(100),
  axisDn: z.number().min(0).max(100),
  axisSf: z.number().min(0).max(100),
  axisCo: z.number().min(0).max(100),
  confidenceLevel: z.number().int().min(0).max(100),
  boundaryAxes: z.array(axisSchema).max(4)
}).strict().superRefine((value, context) => {
  if (value.typeCode.slice(0, 2) !== value.domainCode) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "类型与科研域不匹配" });
  }
});

export const feedbackContactInputSchema = z.object({
  sessionId: sessionIdSchema,
  feedbackId: z.number().int().positive(),
  email: z.string().trim().email().max(254),
  consent: z.literal(true),
  privacyVersion: privacyVersionSchema
}).strict();

export type ConsentInput = z.input<typeof consentInputSchema>;
export type CreateTestRunInput = z.input<typeof createTestRunInputSchema>;
export type SaveTestAnswersInput = z.input<typeof saveTestAnswersInputSchema>;
export type CompleteTestRunInput = z.input<typeof completeTestRunInputSchema>;
export type FeedbackContactInput = z.input<typeof feedbackContactInputSchema>;
