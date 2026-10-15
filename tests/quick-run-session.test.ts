import { describe, expect, it, vi } from "vitest";
import {
  createQuickRunSession,
  type QuickAnswerInput,
  type QuickRunDependencies,
  type QuickRunSummary
} from "../apps/web/lib/quick-run-session";
import type { QuickRunContext } from "../apps/web/lib/quick-run-store";

const RUN_ID = "3f2a1c4e-9b77-4a1e-8f21-0d5c6b7a8e90";
const RESULT_KEY = "quick-1-i";

function makeSummary(): QuickRunSummary {
  return {
    resultKey: RESULT_KEY,
    typeCode: "EDSC",
    domainCode: "ED",
    axisEm: 72,
    axisDn: 40,
    axisSf: 61,
    axisCo: 33,
    confidenceLevel: 78,
    boundaryAxes: ["dn"]
  };
}

function answerBatch(count: number): QuickAnswerInput[] {
  return Array.from({ length: count }, (_, index) => ({
    questionId: `Q${String(index + 1).padStart(3, "0")}`,
    optionId: "a",
    responseTimeMs: 800
  }));
}

interface Harness {
  deps: QuickRunDependencies;
  saved: Array<{ testRunId: string; answers: QuickAnswerInput[] }>;
  completed: Array<{ testRunId: string; summary: QuickRunSummary }>;
  remembered: Array<{ resultKey: string; context: QuickRunContext }>;
}

function createHarness(beginRun: QuickRunDependencies["beginRun"]): Harness {
  const saved: Harness["saved"] = [];
  const completed: Harness["completed"] = [];
  const remembered: Harness["remembered"] = [];
  return {
    saved,
    completed,
    remembered,
    deps: {
      beginRun,
      saveAnswers: (testRunId, answers) => { saved.push({ testRunId, answers }); return Promise.resolve(); },
      completeRun: (testRunId, summary) => { completed.push({ testRunId, summary }); return Promise.resolve(); },
      rememberRun: (resultKey, context) => { remembered.push({ resultKey, context }); }
    }
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

/** 跨过 attach → .then → flush 整条微任务链。 */
function drainMicrotasks(): Promise<void> {
  return new Promise((resolve) => { setTimeout(resolve, 0); });
}

describe("远端 run 与答案队列状态机", () => {
  it("交卷早于 run 返回时，已授权答案与完成调用在 run 回来之后补齐", async () => {
    const gate = deferred<{ testRunId?: string; researchConsent?: boolean }>();
    const harness = createHarness(() => gate.promise);
    const session = createQuickRunSession(harness.deps);

    session.attach(RESULT_KEY, "1.0.0", true);
    for (const item of answerBatch(48)) session.record(item);

    expect(session.settle(makeSummary())).toBe("degraded");
    expect(harness.saved).toHaveLength(0);

    gate.resolve({ testRunId: RUN_ID, researchConsent: true });
    await drainMicrotasks();

    expect(harness.saved).toHaveLength(1);
    expect(harness.saved[0]?.testRunId).toBe(RUN_ID);
    expect(harness.saved[0]?.answers).toHaveLength(48);
    expect(harness.completed).toHaveLength(1);
    expect(harness.completed[0]?.testRunId).toBe(RUN_ID);
    expect(harness.remembered[0]?.context).toEqual({ testRunId: RUN_ID, researchConsent: true });
  });

  it("迟到的 run 没有研究授权时不补发答案，但运营 run 仍要收口", async () => {
    const gate = deferred<{ testRunId?: string; researchConsent?: boolean }>();
    const harness = createHarness(() => gate.promise);
    const session = createQuickRunSession(harness.deps);

    session.attach(RESULT_KEY, "1.0.0", false);
    for (const item of answerBatch(12)) session.record(item);
    expect(session.settle(makeSummary())).toBe("degraded");

    gate.resolve({ testRunId: RUN_ID, researchConsent: false });
    await drainMicrotasks();

    expect(harness.saved).toHaveLength(0);
    // 未授权只挡研究答案，不挡运营收口：否则 test_runs 永远停在 started，
    // 与已写下的匿名结果和漏斗事件对不上。与「run 已就绪、未授权」路径一致。
    expect(harness.completed).toHaveLength(1);
    expect(harness.completed[0]?.testRunId).toBe(RUN_ID);
    expect(harness.completed[0]?.summary).toEqual(makeSummary());
  });

  it("run 已就绪时交卷交给完成接口收口，并带上待发答案", async () => {
    const harness = createHarness(() => Promise.resolve({ testRunId: RUN_ID, researchConsent: true }));
    const session = createQuickRunSession(harness.deps);

    session.attach(RESULT_KEY, "1.0.0", true);
    await drainMicrotasks();
    for (const item of answerBatch(6)) session.record(item);

    expect(session.settle(makeSummary())).toBe("run");
    expect(harness.saved).toHaveLength(1);
    expect(harness.saved[0]?.answers).toHaveLength(6);
    expect(harness.completed).toHaveLength(1);
  });

  it("run 返回未授权时丢弃队列，但仍然标记该运营 run 完成", async () => {
    const harness = createHarness(() => Promise.resolve({ testRunId: RUN_ID, researchConsent: false }));
    const session = createQuickRunSession(harness.deps);

    session.attach(RESULT_KEY, "1.0.0", false);
    for (const item of answerBatch(6)) session.record(item);
    expect(session.bufferedCount()).toBe(6);

    await drainMicrotasks();

    expect(session.bufferedCount()).toBe(0);
    expect(session.settle(makeSummary())).toBe("run");
    expect(harness.saved).toHaveLength(0);
    // 与「run 迟到、未授权」那条用例断言的完全一致——两条路径必须同语义。
    expect(harness.completed).toHaveLength(1);
    expect(harness.completed[0]?.testRunId).toBe(RUN_ID);
    expect(harness.completed[0]?.summary).toEqual(makeSummary());
  });

  it("建 run 失败（无 testRunId）时降级，不写入也不崩", async () => {
    const harness = createHarness(() => Promise.resolve({}));
    const session = createQuickRunSession(harness.deps);

    session.attach(RESULT_KEY, "1.0.0", true);
    for (const item of answerBatch(6)) session.record(item);
    expect(session.settle(makeSummary())).toBe("degraded");
    await drainMicrotasks();

    expect(harness.saved).toHaveLength(0);
    expect(harness.completed).toHaveLength(0);
  });

  it("建 run 抛错时不影响交卷", async () => {
    const harness = createHarness(() => Promise.reject(new Error("offline")));
    const session = createQuickRunSession(harness.deps);

    session.attach(RESULT_KEY, "1.0.0", true);
    for (const item of answerBatch(6)) session.record(item);

    expect(session.settle(makeSummary())).toBe("degraded");
    await drainMicrotasks();
    expect(harness.saved).toHaveLength(0);
  });

  it("run 就绪前 flush 不丢队列，run 回来后一次性发出", async () => {
    const gate = deferred<{ testRunId?: string; researchConsent?: boolean }>();
    const harness = createHarness(() => gate.promise);
    const session = createQuickRunSession(harness.deps);

    session.attach(RESULT_KEY, "1.0.0", true);
    for (const item of answerBatch(6)) session.record(item);
    session.flush();

    expect(session.bufferedCount()).toBe(6);
    expect(harness.saved).toHaveLength(0);

    gate.resolve({ testRunId: RUN_ID, researchConsent: true });
    await drainMicrotasks();

    expect(harness.saved).toHaveLength(1);
    expect(harness.saved[0]?.answers).toHaveLength(6);
  });

  it("adopt 已存在的 run 时不再新建，补录的答案直接发出", () => {
    const beginRun = vi.fn(() => Promise.resolve({ testRunId: RUN_ID, researchConsent: true }));
    const harness = createHarness(beginRun);
    const session = createQuickRunSession(harness.deps);

    session.adopt({ testRunId: RUN_ID, researchConsent: true });
    for (const item of answerBatch(11)) session.record(item);
    session.flush();

    expect(beginRun).not.toHaveBeenCalled();
    expect(harness.saved).toHaveLength(1);
    expect(harness.saved[0]?.answers).toHaveLength(11);
  });

  it("attach 只生效一次，重复调用不会建出第二个 run", async () => {
    const beginRun = vi.fn(() => Promise.resolve({ testRunId: RUN_ID, researchConsent: true }));
    const harness = createHarness(beginRun);
    const session = createQuickRunSession(harness.deps);

    session.attach(RESULT_KEY, "1.0.0", true);
    session.attach(RESULT_KEY, "1.0.0", true);
    await drainMicrotasks();

    expect(beginRun).toHaveBeenCalledTimes(1);
  });
});
