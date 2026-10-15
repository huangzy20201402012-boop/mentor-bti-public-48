import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getQuickRun, clearQuickRuns, rememberQuickRun } from "../apps/web/lib/quick-run-store";
import { readResearchConsentIntent, rememberResearchConsentIntent } from "../apps/web/lib/research-consent-store";

const RUN_ID = "3f2a1c4e-9b77-4a1e-8f21-0d5c6b7a8e90";
const OTHER_RUN_ID = "8c1d0b6a-2e34-4f77-9a10-5b6c7d8e9f01";

type StorageStub = {
  readonly length: number;
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

let backing: Map<string, string>;

function createStorage(): StorageStub {
  return {
    get length() { return backing.size; },
    clear: () => { backing.clear(); },
    getItem: (key) => backing.get(key) ?? null,
    key: (index) => Array.from(backing.keys())[index] ?? null,
    removeItem: (key) => { backing.delete(key); },
    setItem: (key, value) => { backing.set(key, value); }
  };
}

/** 这两个模块在浏览器里跑，Node 里没有 window——测试自己装一个最小 sessionStorage。 */
function installWindow(storage: StorageStub | (() => never)): void {
  const sessionStorage = typeof storage === "function"
    ? {
        get length(): number { return 0; },
        clear: (): never => storage(),
        getItem: (): never => storage(),
        key: (): never => storage(),
        removeItem: (): never => storage(),
        setItem: (): never => storage()
      }
    : storage;
  (globalThis as unknown as { window: { sessionStorage: StorageStub } }).window = { sessionStorage };
}

function removeWindow(): void {
  delete (globalThis as unknown as { window?: unknown }).window;
}

beforeEach(() => { backing = new Map(); installWindow(createStorage()); });
afterEach(() => { removeWindow(); });

describe("匿名研究授权意图", () => {
  it("记录后读回一致", () => {
    rememberResearchConsentIntent(true);
    expect(readResearchConsentIntent()).toBe(true);
    rememberResearchConsentIntent(false);
    expect(readResearchConsentIntent()).toBe(false);
  });

  it("没记录过时读作未授权", () => {
    expect(readResearchConsentIntent()).toBe(false);
  });

  it("存储不可读时退回未授权，而不是抛错", () => {
    installWindow(() => { throw new Error("storage disabled"); });
    expect(readResearchConsentIntent()).toBe(false);
  });

  it("写入失败不抛错", () => {
    installWindow(() => { throw new Error("quota exceeded"); });
    expect(() => rememberResearchConsentIntent(true)).not.toThrow();
  });

  it("没有 window 时读作未授权", () => {
    removeWindow();
    expect(readResearchConsentIntent()).toBe(false);
  });
});

describe("本次测试的远端 run 映射", () => {
  it("记录后能按 resultKey 取回", () => {
    rememberQuickRun("key-a", { testRunId: RUN_ID, researchConsent: true });
    expect(getQuickRun("key-a")).toEqual({ testRunId: RUN_ID, researchConsent: true });
  });

  it("不同 resultKey 互不串号", () => {
    rememberQuickRun("key-a", { testRunId: RUN_ID, researchConsent: true });
    rememberQuickRun("key-b", { testRunId: OTHER_RUN_ID, researchConsent: false });
    expect(getQuickRun("key-a")?.testRunId).toBe(RUN_ID);
    expect(getQuickRun("key-b")?.testRunId).toBe(OTHER_RUN_ID);
  });

  it("没有记录过的 resultKey 返回 null", () => {
    expect(getQuickRun("key-missing")).toBeNull();
  });

  it("testRunId 不是合法 UUID 时按无 run 处理", () => {
    rememberQuickRun("key-a", { testRunId: "not-a-uuid", researchConsent: true });
    expect(getQuickRun("key-a")).toBeNull();
  });

  it("存储损坏时按无 run 处理", () => {
    backing.set("mentor-bti:quick-run:key-a", "{ broken json");
    expect(getQuickRun("key-a")).toBeNull();
  });

  it("清空后取不到，但不影响本次进程内已落盘的其它键", () => {
    rememberQuickRun("key-a", { testRunId: RUN_ID, researchConsent: true });
    backing.set("mentor-bti:something-else", "keep");
    clearQuickRuns();
    expect(getQuickRun("key-a")).toBeNull();
    expect(backing.get("mentor-bti:something-else")).toBe("keep");
  });

  it("没有 window 时写入不抛错、读取返回 null", () => {
    removeWindow();
    expect(() => rememberQuickRun("key-a", { testRunId: RUN_ID, researchConsent: true })).not.toThrow();
    expect(getQuickRun("key-a")).toBeNull();
  });
});
