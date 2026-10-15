import type { QuickRunContext } from "./quick-run-store";

/**
 * 远端 run 与答案队列的状态机。
 *
 * 抽成不依赖 React 的纯模块，是因为它最危险的行为发生在一个 React 测不到的
 * 时序里：`beginQuickTestRun()` 还在请求中，用户已经答完 48 题并点了「看结果」。
 * 此时交卷既不能等（会卡住跳转），也不能丢（用户已明确授权）。这里的规则是
 * 「先按匿名降级把运营数据写掉，再等迟到的 run 回来补发授权答案」。
 *
 * 所有依赖由调用方注入，因此这段时序可以用假实现直接测（见 tests/quick-run-session.test.ts）。
 */

export interface QuickAnswerInput {
  questionId: string;
  optionId: string;
  responseTimeMs?: number;
}

export interface QuickRunSummary {
  resultKey: string;
  typeCode: string;
  domainCode: string;
  axisEm: number;
  axisDn: number;
  axisSf: number;
  axisCo: number;
  confidenceLevel: number;
  boundaryAxes: string[];
}

export interface QuickRunDependencies {
  beginRun(contentVersion: string, researchConsent: boolean): Promise<{ testRunId?: string; researchConsent?: boolean }>;
  saveAnswers(testRunId: string, answers: QuickAnswerInput[]): Promise<unknown>;
  completeRun(testRunId: string, summary: QuickRunSummary): Promise<unknown>;
  rememberRun(resultKey: string, context: QuickRunContext): void;
}

export interface QuickRunSession {
  /** 后台创建远端 run。交卷可能早于它返回，因此调用方**不得**在卸载时取消它。 */
  attach(resultKey: string, contentVersion: string, researchConsent: boolean): void;
  /** 接管一次已存在的 run（刷新恢复），不新建。 */
  adopt(context: QuickRunContext): void;
  record(answer: QuickAnswerInput): void;
  /** 把本地队列发给服务端；run 未就绪则继续排队，未授权则丢弃。 */
  flush(): void;
  bufferedCount(): number;
  /** 交卷。返回 "run" 表示已交给远端 run 收口，"degraded" 表示调用方需自行写匿名降级结果。 */
  settle(summary: QuickRunSummary): "run" | "degraded";
}

export function createQuickRunSession(deps: QuickRunDependencies): QuickRunSession {
  let context: QuickRunContext | null = null;
  let startPromise: Promise<QuickRunContext | null> | null = null;
  const pending = new Map<string, QuickAnswerInput>();

  function deliver(target: QuickRunContext, answers: QuickAnswerInput[]): void {
    if (!target.researchConsent || answers.length === 0) return;
    void deps.saveAnswers(target.testRunId, answers);
  }

  function flush(): void {
    if (!context) return; // run 还没就绪：答案继续在本地排队
    if (!context.researchConsent) { pending.clear(); return; }
    if (pending.size === 0) return;
    const batch = Array.from(pending.values());
    pending.clear();
    void deps.saveAnswers(context.testRunId, batch);
  }

  return {
    attach(resultKey, contentVersion, researchConsent) {
      if (startPromise) return;
      startPromise = deps.beginRun(contentVersion, researchConsent)
        .then((remote): QuickRunContext | null => {
          if (!remote.testRunId) return null;
          const next: QuickRunContext = { testRunId: remote.testRunId, researchConsent: remote.researchConsent === true };
          context = next;
          deps.rememberRun(resultKey, next);
          flush();
          return next;
        })
        .catch((): QuickRunContext | null => null);
    },

    adopt(next) { context = next; },

    // run 未就绪时先排队，等它带着授权结论回来再决定发还是丢——两个方向都不能猜。
    record(answer) {
      if (!context || context.researchConsent) pending.set(answer.questionId, answer);
    },

    flush,
    bufferedCount: () => pending.size,

    settle(summary) {
      const snapshot = Array.from(pending.values());
      pending.clear();
      if (context?.testRunId) {
        deliver(context, snapshot);
        void deps.completeRun(context.testRunId, summary);
        return "run";
      }
      // run 迟到：调用方照常写匿名降级结果，这里等它回来补发并收口。
      // 无论有没有研究授权，运营 run 都必须收口——否则 test_runs 会永远停在
      // started，与已经写下的匿名结果、与漏斗事件对不上。未授权时 deliver()
      // 自身就是 no-op，所以这里不跳过 completeRun，与 run 已就绪的路径语义一致。
      void startPromise?.then((late) => {
        if (!late?.testRunId) return;
        deliver(late, snapshot);
        void deps.completeRun(late.testRunId, summary);
      });
      return "degraded";
    }
  };
}
