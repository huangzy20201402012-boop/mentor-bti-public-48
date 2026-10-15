import { describe, expect, it } from "vitest";
import {
  analyticsEventInputSchema,
  anonymousResultInputSchema,
  completeTestRunInputSchema,
  consentInputSchema,
  createTestRunInputSchema,
  feedbackContactInputSchema,
  feedbackInputSchema,
  resultFeedbackInputSchema,
  saveTestAnswersInputSchema
} from "../apps/web/lib/analytics/contracts";

const sessionId = "7d444b6d-5c80-4f6f-a4f6-315cb9768edf";

describe("Supabase analytics and feedback contracts", () => {
  it("accepts a whitelisted quick-test checkpoint event", () => {
    const result = analyticsEventInputSchema.safeParse({
      sessionId,
      eventName: "quick_test_question_reached",
      pagePath: "/quick/test",
      questionIndex: 12,
      questionId: "Q012"
    });
    expect(result.success).toBe(true);
  });

  it("rejects arbitrary events and incomplete question events", () => {
    expect(analyticsEventInputSchema.safeParse({ sessionId, eventName: "mouse_move", pagePath: "/" }).success).toBe(false);
    expect(analyticsEventInputSchema.safeParse({ sessionId, eventName: "quick_test_na_selected", pagePath: "/quick/test" }).success).toBe(false);
  });

  it("stores only a validated result summary", () => {
    const result = anonymousResultInputSchema.safeParse({
      sessionId,
      resultKey: "quick-abc123",
      typeCode: "EDSC",
      domainCode: "ED",
      axisEm: 64,
      axisDn: 57,
      axisSf: 72,
      axisCo: 51,
      confidenceLevel: 68,
      boundaryAxes: ["co"],
      scoringVersion: "quick-v1.0",
      contentVersion: "1.0.0"
    });
    expect(result.success).toBe(true);
    expect(anonymousResultInputSchema.safeParse({ ...result.data, answers: { Q001: "a" } }).success).toBe(false);
  });

  it("rejects mismatched type/domain and unsafe feedback fields", () => {
    expect(anonymousResultInputSchema.safeParse({
      sessionId,
      resultKey: "quick-abc123",
      typeCode: "EDSC",
      domainCode: "EN",
      axisEm: 64,
      axisDn: 57,
      axisSf: 72,
      axisCo: 51,
      confidenceLevel: 68,
      boundaryAxes: [],
      scoringVersion: "quick-v1.0",
      contentVersion: "1.0.0"
    }).success).toBe(false);
    expect(feedbackInputSchema.safeParse({ sessionId, feedbackType: "general", message: "x".repeat(1001) }).success).toBe(false);
    expect(feedbackInputSchema.safeParse({ sessionId, feedbackType: "question_unclear", questionId: "Q012", reasonCode: "no_suitable_option" }).success).toBe(true);
    expect(feedbackInputSchema.safeParse({ sessionId, feedbackType: "question_unclear", questionId: "Q012" }).success).toBe(false);
    expect(resultFeedbackInputSchema.safeParse({
      sessionId,
      resultKey: "quick-abc123",
      typeCode: "EDSC",
      domainCode: "ED",
      accuracyRating: 5,
      reasonTags: ["unknown_reason"]
    }).success).toBe(false);
  });

  it("separates native share actions from link-copy actions", () => {
    expect(analyticsEventInputSchema.safeParse({
      sessionId,
      eventName: "share_to_peer_click",
      pagePath: "/result/quick/example",
      typeCode: "EDSC",
      domainCode: "ED",
      metadata: { shareMethod: "native" }
    }).success).toBe(true);
    expect(analyticsEventInputSchema.safeParse({
      sessionId,
      eventName: "share_to_peer_click",
      pagePath: "/result/quick/example",
      typeCode: "EDSC",
      domainCode: "ED"
    }).success).toBe(false);
  });

  it("accepts the approved positive-result and share-issue vocabulary", () => {
    expect(resultFeedbackInputSchema.safeParse({
      sessionId,
      resultKey: "quick-abc123",
      typeCode: "EDSC",
      domainCode: "ED",
      accuracyRating: 5,
      reasonTags: ["axis_matches", "details_resonate"]
    }).success).toBe(true);
    expect(feedbackInputSchema.safeParse({
      sessionId,
      feedbackType: "share_issue",
      message: "复制链接后没有看到成功提示。",
      pagePath: "/result/quick/example"
    }).success).toBe(true);
  });

  it("accepts the V1.1 type-mismatch reason while keeping its result context valid", () => {
    expect(resultFeedbackInputSchema.safeParse({
      sessionId,
      resultKey: "quick-abc123",
      typeCode: "EDSC",
      domainCode: "ED",
      accuracyRating: 1,
      reasonTags: ["type_mismatch", "axis_mismatch"],
      testRunId: "b4dd47b9-73d0-4c3c-83bd-582cdf8ec12a",
      questionnaireVersion: "quick-q-v1.0",
      scoringVersion: "quick-v1.0"
    }).success).toBe(true);
  });

  it("requires a versioned explicit consent record and a versioned quick run", () => {
    expect(consentInputSchema.safeParse({
      sessionId,
      consentType: "anonymous_research",
      granted: true,
      privacyVersion: "privacy-v1.1"
    }).success).toBe(true);
    expect(consentInputSchema.safeParse({ sessionId, consentType: "anonymous_research", granted: true }).success).toBe(false);
    expect(createTestRunInputSchema.safeParse({
      sessionId,
      questionnaireVersion: "quick-q-v1.0",
      scoringVersion: "quick-v1.0",
      contentVersion: "1.0.0",
      privacyVersion: "privacy-v1.1"
    }).success).toBe(true);
  });

  it("allows only bounded, deduplicated answer batches and a valid completion summary", () => {
    expect(saveTestAnswersInputSchema.safeParse({
      sessionId,
      answers: [
        { questionId: "Q001", optionId: "a", responseTimeMs: 800 },
        { questionId: "Q002", optionId: "na" }
      ]
    }).success).toBe(true);
    expect(saveTestAnswersInputSchema.safeParse({
      sessionId,
      answers: [{ questionId: "Q001", optionId: "a" }, { questionId: "Q001", optionId: "b" }]
    }).success).toBe(false);
    expect(completeTestRunInputSchema.safeParse({
      sessionId,
      resultKey: "quick-abc123",
      typeCode: "EDSC",
      domainCode: "ED",
      axisEm: 50,
      axisDn: 50,
      axisSf: 50,
      axisCo: 50,
      confidenceLevel: 0,
      boundaryAxes: ["em", "dn", "sf", "co"]
    }).success).toBe(true);
  });

  it("keeps contact data separate and requires explicit contact permission", () => {
    expect(feedbackContactInputSchema.safeParse({
      sessionId,
      feedbackId: 1,
      email: "researcher@example.com",
      consent: true,
      privacyVersion: "privacy-v1.1"
    }).success).toBe(true);
    expect(feedbackContactInputSchema.safeParse({
      sessionId,
      feedbackId: 1,
      email: "researcher@example.com",
      consent: false,
      privacyVersion: "privacy-v1.1"
    }).success).toBe(false);
  });
});
