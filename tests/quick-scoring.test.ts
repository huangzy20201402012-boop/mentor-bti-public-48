import { describe, expect, it } from "vitest";
import { btiContent } from "@mentor-bti/bti-content";
import { createQuickShareCardPayload, scoreQuickTest } from "@mentor-bti/bti-scoring";
import type { Answer, TestDefinition } from "@mentor-bti/bti-core";

function answerEveryQuestion(optionIndex: number): Record<string, Answer> {
  return Object.fromEntries(
    btiContent.quickTest.questions.map((question) => [question.id, { optionId: question.options[optionIndex]?.id ?? question.options.at(-1)!.id }])
  );
}

function score(answers: Record<string, Answer>, definition = btiContent.quickTest) {
  return scoreQuickTest({
    definition,
    dimensions: btiContent.dimensions,
    personalities: btiContent.personalities,
    resultRules: btiContent.resultRules,
    answers
  });
}

describe("48题评分引擎", () => {
  it("uses the four left endpoints to classify EDSC", () => {
    const result = score(answerEveryQuestion(0));

    expect(result.typeCode).toBe("EDSC");
    expect(result.personality.name).toBe("深研引导师");
  });

  it("uses the four right endpoints to classify MNFO", () => {
    const result = score(answerEveryQuestion(4));

    expect(result.typeCode).toBe("MNFO");
    expect(result.personality.name).toBe("任务执掌者");
  });

  it("removes N/A responses from the axis denominator", () => {
    const answers = answerEveryQuestion(0);
    answers.Q001 = { optionId: "na" };

    const result = score(answers);
    expect(result.axes.em.coverage).toBeLessThan(1);
    expect(result.axes.em.left.percent).toBe(100);
  });

  it("marks all N/A responses as retry-quality instead of treating the type as reliable", () => {
    const answers = Object.fromEntries(btiContent.quickTest.questions.map((question) => [question.id, { optionId: "na" }])) as Record<string, Answer>;
    const result = score(answers);

    expect(result.typeCode).toBe("EDSC");
    expect(result.responseQuality.label).toBe("retry");
    expect(result.responseQuality.coverage).toBe(0);
  });

  it("uses Q047/Q048 only as consistency checks and never to change a type axis", () => {
    const consistentAnswers = answerEveryQuestion(0);
    const inconsistentAnswers = { ...consistentAnswers, Q047: { optionId: "5" }, Q048: { optionId: "5" } };
    const consistent = score(consistentAnswers);
    const inconsistent = score(inconsistentAnswers);

    expect(inconsistent.typeCode).toBe(consistent.typeCode);
    expect(inconsistent.responseQuality.consistency).toBeLessThan(consistent.responseQuality.consistency);
  });

  it("uses the approved left-endpoint fallback for exactly 50/50 axes", () => {
    const centerQuestions = ["Q002", "Q008", "Q015", "Q020"];
    const definition: TestDefinition = {
      ...btiContent.quickTest,
      questionCount: centerQuestions.length,
      questions: btiContent.quickTest.questions.filter((question) => centerQuestions.includes(question.id))
    };
    const answers = Object.fromEntries(centerQuestions.map((questionId) => [questionId, { optionId: "3" }])) as Record<string, Answer>;
    const result = score(answers, definition);

    expect(result.typeCode).toBe("EDSC");
    expect(Object.values(result.axes).every((axis) => axis.isBoundary)).toBe(true);
  });

  it("creates a non-identifying sharing payload from a quick result", () => {
    const result = score(answerEveryQuestion(0));
    const shareCard = createQuickShareCardPayload(result, "深研探索域");

    expect(shareCard.typeCode).toBe("EDSC");
    expect(shareCard.axes).toHaveLength(4);
    expect(shareCard.brandLine).not.toContain("总分");
  });
});
