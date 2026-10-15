import type { Answer, TestKind, TestSession } from "./types";

export function createSession(input: {
  id: string;
  test: TestKind;
  contentVersion: string;
  firstQuestionId: string;
  now?: Date;
}): TestSession {
  const timestamp = (input.now ?? new Date()).toISOString();
  return {
    schemaVersion: 1,
    id: input.id,
    test: input.test,
    contentVersion: input.contentVersion,
    status: "in_progress",
    startedAt: timestamp,
    updatedAt: timestamp,
    currentQuestionId: input.firstQuestionId,
    answers: {}
  };
}

export function recordAnswer(session: TestSession, questionId: string, answer: Answer, now = new Date()): TestSession {
  return {
    ...session,
    updatedAt: now.toISOString(),
    answers: { ...session.answers, [questionId]: answer }
  };
}

export function moveToQuestion(session: TestSession, questionId: string, now = new Date()): TestSession {
  return { ...session, currentQuestionId: questionId, updatedAt: now.toISOString() };
}

export function completeSession(session: TestSession, resultId: string, now = new Date()): TestSession {
  const timestamp = now.toISOString();
  return { ...session, status: "completed", completedAt: timestamp, updatedAt: timestamp, resultId };
}
