"use client";

import { completeSession, createSession, moveToQuestion, recordAnswer } from "@mentor-bti/bti-core";
import type { DimensionDefinition, Personality, ResultRuleSet, TestDefinition, TestSession } from "@mentor-bti/bti-core";
import { scoreQuickTest } from "@mentor-bti/bti-scoring";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveAnonymousResult, trackEvent } from "../lib/analytics/client";
import { QUICK_SCORING_VERSION } from "../lib/analytics/version";
import { createClientSessionId } from "../lib/client-session-id";
import { saveQuickResultToCloud } from "../lib/cloud/client";
import { beginQuickTestRun, completeQuickTestRun, saveQuickTestAnswers } from "../lib/data/client";
import { QuestionFeedbackEntry } from "./feedback/QuestionFeedbackEntry";
import { createQuickRunSession, type QuickRunSession } from "../lib/quick-run-session";
import { clearQuickRuns, getQuickRun, rememberQuickRun } from "../lib/quick-run-store";
import { readResearchConsentIntent } from "../lib/research-consent-store";
import { restoreTestSession, saveTestSession } from "../lib/test-session-store";

const CHECKPOINT_INDICES = new Set([1, 6, 12, 18, 24, 30, 36, 42, 48]);
/** 远端答案的发送节奏：每 6 题一次，外加切到后台与交卷。 */
const ANSWER_FLUSH_INTERVAL = 6;
const MAX_RESPONSE_TIME_MS = 30 * 60 * 1000;

export function QuickTestExperience({ ownerId, quickTest, dimensions, personalities, resultRules }: { ownerId: string; quickTest: TestDefinition; dimensions: DimensionDefinition[]; personalities: Personality[]; resultRules: ResultRuleSet }) {
  const router = useRouter();
  const [session, setSession] = useState<ReturnType<typeof createSession> | null>(null);
  const [ready, setReady] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [resultSaveError, setResultSaveError] = useState<string | null>(null);
  const questionHeadingRef = useRef<HTMLHeadingElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const trackedQuestionIdsRef = useRef(new Set<string>());
  // run 与答案队列都必须是组件级状态：question-panel 带 key={question.id}，
  // 每换一题就重挂载，任何状态放进去都会在换题时被丢掉。
  const runSessionRef = useRef<QuickRunSession | null>(null);
  const questionShownAtRef = useRef(0);
  const freshSessionIdRef = useRef<string | null>(null);
  const resumedSessionRef = useRef<TestSession | null>(null);
  const questions = quickTest.questions;

  if (runSessionRef.current === null) {
    runSessionRef.current = createQuickRunSession({
      beginRun: beginQuickTestRun,
      saveAnswers: saveQuickTestAnswers,
      completeRun: completeQuickTestRun,
      rememberRun: rememberQuickRun
    });
  }

  useEffect(() => {
    const restored = restoreTestSession({ test: "quick", contentVersion: quickTest.version, knownQuestionIds: new Set(questions.map((question) => question.id)), ownerId });
    if (restored) { resumedSessionRef.current = restored; setSession(restored); setReady(true); trackEvent("quick_test_resume"); return; }
    const firstQuestion = questions[0];
    if (!firstQuestion) { setFailureMessage("题库暂时不可用，请稍后再试。"); setReady(true); return; }
    const started = createSession({ id: createClientSessionId(), test: "quick", contentVersion: quickTest.version, firstQuestionId: firstQuestion.id });
    freshSessionIdRef.current = started.id;
    clearQuickRuns();
    saveTestSession(started, ownerId);
    setSession(started); setReady(true); trackEvent("quick_test_start");
  }, [ownerId, questions, quickTest.version]);

  /**
   * 把本次访问接到一个远端 run 上。
   *
   * 全新测试：建新 run。刷新恢复：先认领已经建过的 run，没有映射且本次意图明确
   * 授权时才补建一个——不该为一次刷新平白多造一个运营 run。
   *
   * 这里**故意不返回 cleanup 去取消**：交卷可能早于这次请求返回，答案要靠它补发。
   */
  useEffect(() => {
    if (!ready) return;
    const runSession = runSessionRef.current;
    if (!runSession) return;

    const fresh = freshSessionIdRef.current;
    if (fresh) { runSession.attach(fresh, quickTest.version, readResearchConsentIntent()); return; }

    const resumed = resumedSessionRef.current;
    if (!resumed) return;
    const existing = getQuickRun(resumed.id);
    if (existing) runSession.adopt(existing);
    else if (readResearchConsentIntent()) runSession.attach(resumed.id, quickTest.version, true);
    else return;

    // 刷新前答过的题只存在于本地会话里。补录进队列，交卷时随 run 一起写入——
    // 服务端对 (test_run_id, question_id) 幂等，重复补发是安全的。
    for (const [questionId, answer] of Object.entries(resumed.answers)) {
      runSession.record({ questionId, optionId: answer.optionId });
    }
    runSession.flush();
  }, [ready, quickTest.version]);

  /** 把本地队列发给服务端；403 / 503 / 网络失败一律丢弃，绝不变成用户可见的错误。 */
  const flushAnswers = useCallback((): void => { runSessionRef.current?.flush(); }, []);

  useEffect(() => {
    function onVisibilityChange(): void { if (document.visibilityState === "hidden") flushAnswers(); }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [flushAnswers]);

  const currentIndex = useMemo(() => session ? Math.max(0, questions.findIndex((question) => question.id === session.currentQuestionId)) : 0, [questions, session]);
  const question = questions[currentIndex];
  const answeredCount = session ? Object.keys(session.answers).length : 0;

  useEffect(() => {
    if (ready && question) questionHeadingRef.current?.focus({ preventScroll: true });
    if (question) questionShownAtRef.current = Date.now();
  }, [question?.id, ready]);

  useEffect(() => {
    const questionIndex = currentIndex + 1;
    if (!ready || !question || !session || !CHECKPOINT_INDICES.has(questionIndex) || trackedQuestionIdsRef.current.has(question.id)) return;
    trackedQuestionIdsRef.current.add(question.id);
    trackEvent("quick_test_question_reached", { questionIndex, questionId: question.id });
  }, [currentIndex, question, ready, session]);

  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  function flashSaved(): void {
    setJustSaved(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => setJustSaved(false), 1500);
  }

  function persist(next: ReturnType<typeof createSession>): void { saveTestSession(next, ownerId); setSession(next); }
  function goTo(index: number): void { if (session && questions[index]) persist(moveToQuestion(session, questions[index].id)); }
  function answer(optionId: string): void {
    if (!session || !question) return;
    if (optionId === "na") trackEvent("quick_test_na_selected", { questionIndex: currentIndex + 1, questionId: question.id });
    const updated = recordAnswer(session, question.id, { optionId });
    // run 还没就绪时也先排队：等它带着授权结论回来，再由 flush 决定发还是丢。
    // 计时缺省时省略整个属性——显式写 undefined 在 exactOptionalPropertyTypes 下非法。
    const elapsed = questionShownAtRef.current ? Math.min(Date.now() - questionShownAtRef.current, MAX_RESPONSE_TIME_MS) : undefined;
    runSessionRef.current?.record({
      questionId: question.id,
      optionId,
      ...(elapsed === undefined ? {} : { responseTimeMs: elapsed })
    });
    if ((currentIndex + 1) % ANSWER_FLUSH_INTERVAL === 0) flushAnswers();
    if (currentIndex < questions.length - 1) persist(moveToQuestion(updated, questions[currentIndex + 1]!.id)); else persist(updated);
    flashSaved();
  }
  async function finish(): Promise<void> {
    if (!session || answeredCount !== questions.length || finishing) return;
    setFinishing(true);
    setResultSaveError(null);
    try {
      const result = scoreQuickTest({ definition: quickTest, dimensions, personalities, resultRules, answers: session.answers });
      const saved = await saveQuickResultToCloud({ resultKey: session.id, result, expectedOwnerId: ownerId });
      if (saved !== "saved") {
        setResultSaveError(saved === "skipped"
          ? "登录状态已失效。请刷新页面并重新登录，已作答的内容会保留在当前设备。"
          : "结果暂时无法保存到你的账户。请检查网络后重试，已作答的内容会保留在当前设备。");
        setFinishing(false);
        return;
      }
      window.dispatchEvent(new Event("mentor-bti:stats-changed"));
      const completed = completeSession(session, `quick-${session.id}`);
      const boundaryAxes = (["em", "dn", "sf", "co"] as const).filter((axis) => result.axes[axis].isBoundary);
      const summary = {
        resultKey: session.id,
        typeCode: result.typeCode,
        domainCode: result.personality.domain,
        axisEm: result.axes.em.left.percent,
        axisDn: result.axes.dn.left.percent,
        axisSf: result.axes.sf.left.percent,
        axisCo: result.axes.co.left.percent,
        confidenceLevel: result.typeConfidence,
        boundaryAxes
      };
      // 有 run 走完成接口：它除了标记 run 完成，同样会把结果摘要 upsert 进
      // anonymous_results，并带上 test_run_id。run 迟到时先按匿名降级把运营数据
      // 写掉，再由 session 等它回来补发已授权答案并收口。
      if (runSessionRef.current?.settle(summary) !== "run") {
        saveAnonymousResult({ ...summary, scoringVersion: QUICK_SCORING_VERSION, contentVersion: result.contentVersion });
      }
      trackEvent("quick_test_complete", { typeCode: result.typeCode, domainCode: result.personality.domain });
      saveTestSession(completed, ownerId);
      router.push(`/result/quick/${session.id}`);
    } catch {
      setFinishing(false);
      setResultSaveError("暂时无法生成结果，请保留当前答案后重试。");
    }
  }

  if (failureMessage) return <main className="statement"><p className="eyebrow">导师BTI</p><h1>暂时无法继续。</h1><p>{failureMessage}</p><button className="button button-primary" type="button" onClick={() => window.location.reload()}>重新加载测试</button></main>;
  if (finishing) return <main className="statement site-shell" role="status" aria-live="polite"><p className="eyebrow">导师BTI</p><h1>正在保存你的结果…</h1><p>保存到你的账户后会自动打开结果。</p></main>;
  if (!ready || !session || !question) return <main className="statement"><p className="eyebrow">导师BTI</p><h1>正在准备题目…</h1></main>;
  const selected = session.answers[question.id]?.optionId;
  const isComplete = answeredCount === questions.length;
  return (
    <main className="test-page site-shell">
      <header className="test-header"><div aria-live="polite"><p className="eyebrow">48题人格速测</p><p>第 {currentIndex + 1} 题，共 {questions.length} 题</p></div><div className="test-header-right"><span className="test-percent">{Math.round((answeredCount / questions.length) * 100)}%</span><span className={`test-autosave ${justSaved ? "test-autosave-saved" : ""}`}>{justSaved ? "已自动保存" : "自动保存已开启"}</span></div></header>
      <div className="test-progress"><i style={{ width: `${(answeredCount / questions.length) * 100}%` }} /></div>
      <section className="question-panel" key={question.id}><div className="question-kind-row"><p className="question-kind">根据你的真实科研互动感受作答{question.context.includes("quality") ? " · 作答一致性校验，不影响类型判定" : ""}</p><QuestionFeedbackEntry questionId={question.id} questionIndex={currentIndex + 1} /></div><h1 ref={questionHeadingRef} tabIndex={-1}>{question.prompt}</h1><div className="answer-list" role="group" aria-label="选择你的回答">{question.options.map((option) => <button className={selected === option.id ? "selected" : ""} key={option.id} aria-pressed={selected === option.id} onClick={() => answer(option.id)}><span>{option.label}</span><i aria-hidden="true" /></button>)}</div>{question.naAllowed ? <button className="na-button" aria-pressed={selected === "na"} onClick={() => answer("na")}>{selected === "na" ? "已选择：不清楚／不适用" : "不清楚／不适用"}</button> : null}</section>
      {resultSaveError ? <p className="auth-error" role="alert">{resultSaveError}</p> : null}
      <footer className="test-footer"><button className="text-button" onClick={() => goTo(currentIndex - 1)} disabled={currentIndex === 0}>← 上一题</button>{isComplete ? <button className="button button-primary" onClick={() => void finish()}>查看我的结果</button> : <button className="text-button" onClick={() => goTo(currentIndex + 1)} disabled={!selected}>下一题 →</button>}</footer>
    </main>
  );
}
