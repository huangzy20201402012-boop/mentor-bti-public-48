import { describe, expect, it } from "vitest";
import { completeSession, createSession, moveToQuestion, recordAnswer } from "@mentor-bti/bti-core";

describe("test session state", () => {
  it("preserves an answer while moving and completing a session", () => {
    const created = createSession({ id: "session-1", test: "quick", contentVersion: "1.0.0", firstQuestionId: "Q001", now: new Date("2026-08-29T00:00:00.000Z") });
    const answered = recordAnswer(created, "Q001", { optionId: "a" }, new Date("2026-08-29T00:01:00.000Z"));
    const moved = moveToQuestion(answered, "Q002", new Date("2026-08-29T00:02:00.000Z"));
    const completed = completeSession(moved, "result-1", new Date("2026-08-29T00:03:00.000Z"));

    expect(completed.answers.Q001).toEqual({ optionId: "a" });
    expect(completed.currentQuestionId).toBe("Q002");
    expect(completed.status).toBe("completed");
    expect(completed.resultId).toBe("result-1");
  });
});

