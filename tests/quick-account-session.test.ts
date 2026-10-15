import { createSession } from "@mentor-bti/bti-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { restoreTestSession, saveTestSession, testSessionKey } from "../apps/web/lib/test-session-store";

const OWNER_A = "8c1d0b6a-2e34-4f77-9a10-5b6c7d8e9f01";
const OWNER_B = "8c1d0b6a-2e34-4f77-9a10-5b6c7d8e9f02";
const QUESTION_ID = "q-1";
const VERSION = "1.0.0";
const saved = new Map<string, string>();

beforeEach(() => {
  saved.clear();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => { saved.set(key, value); },
      removeItem: (key: string) => { saved.delete(key); }
    }
  };
});

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe("48 题答题进度按账户隔离", () => {
  it("相同浏览器里另一个账户不能恢复前一账户的答案", () => {
    const session = createSession({ id: "a-draft", test: "quick", contentVersion: VERSION, firstQuestionId: QUESTION_ID });
    saveTestSession({ ...session, answers: { [QUESTION_ID]: { optionId: "option-a" } } }, OWNER_A);

    const restore = (ownerId: string) => restoreTestSession({
      test: "quick", contentVersion: VERSION, knownQuestionIds: new Set([QUESTION_ID]), ownerId
    });
    expect(restore(OWNER_A)?.answers[QUESTION_ID]).toEqual({ optionId: "option-a" });
    expect(restore(OWNER_B)).toBeNull();
  });

  it("不恢复旧版未按账户保存的匿名进度", () => {
    const session = createSession({ id: "legacy-draft", test: "quick", contentVersion: VERSION, firstQuestionId: QUESTION_ID });
    saved.set(testSessionKey("quick"), JSON.stringify(session));

    expect(restoreTestSession({
      test: "quick", contentVersion: VERSION, knownQuestionIds: new Set([QUESTION_ID]), ownerId: OWNER_A
    })).toBeNull();
    expect(saved.has(testSessionKey("quick"))).toBe(true);
  });
});
