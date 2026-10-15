import { describe, expect, it, vi } from "vitest";
import {
  buildQuickResultRow,
  createCloudResultId,
  createQuickResultSaver,
  isUuid,
  resolveCloudResultId
} from "../apps/web/lib/cloud/quick-results";

const UUID = "3f2a1c4e-9b77-4a1e-8f21-0d5c6b7a8e90";
const OWNER = "8c1d0b6a-2e34-4f77-9a10-5b6c7d8e9f01";
const RESULT_KEY = "quick-1a2b3c";

// 不标注返回类型：payload 是「至少带 contentVersion 的任意结果对象」，
// 具体形状由推断得到，标注成 QuickResultPayload 反而会切掉额外字段。
function payload() {
  return { contentVersion: "1.0.0", typeCode: "EDSC", typeConfidence: 78 };
}

describe("云端结果 ID", () => {
  it("识别合法 UUID", () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid("quick-1a2b3c")).toBe(false);
    expect(isUuid("")).toBe(false);
  });

  it("本地结果键已是 UUID 时原样沿用", () => {
    expect(resolveCloudResultId(UUID)).toBe(UUID);
  });

  it("本地结果键不是 UUID 时另生成一个合法 UUID", () => {
    const id = resolveCloudResultId(RESULT_KEY);
    expect(isUuid(id)).toBe(true);
    expect(id).not.toBe(RESULT_KEY);
  });

  it("优先使用 randomUUID", () => {
    const id = createCloudResultId({ cryptoSource: { randomUUID: () => UUID } });
    expect(id).toBe(UUID);
  });

  it("没有 randomUUID 时用随机字节拼出合法的 v4 UUID", () => {
    const id = createCloudResultId({
      cryptoSource: { getRandomValues: (array: Uint8Array) => array.fill(0) as Uint8Array }
    });
    expect(id).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("完全没有 crypto 时仍返回合法 UUID，不抛错", () => {
    const id = createCloudResultId({ cryptoSource: null });
    expect(isUuid(id)).toBe(true);
  });
});

describe("云端结果行", () => {
  it("content_version 取自结果本身，不额外要求调用方传参", () => {
    const row = buildQuickResultRow({ resultKey: RESULT_KEY, ownerId: OWNER, result: payload() });
    expect(row.content_version).toBe("1.0.0");
  });

  it("只产生约定的五个字段，不夹带任何多余内容", () => {
    const row = buildQuickResultRow({ resultKey: RESULT_KEY, ownerId: OWNER, result: payload() });
    expect(Object.keys(row).sort()).toEqual(["content_version", "id", "owner_id", "result_key", "result_payload"]);
  });

  it("原始作答不会进入 result_payload", () => {
    // 结果对象里只有派生分数。这里显式验证：即使调用方误把作答挂在结果旁边，
    // 也不会被带进这一行——行只由这几个已知字段拼成。
    const withAnswers = { ...payload(), answers: { Q001: { optionId: "a" } } };
    const row = buildQuickResultRow({ resultKey: RESULT_KEY, ownerId: OWNER, result: withAnswers });
    expect(Object.keys(row)).toHaveLength(5);
    expect(row.result_payload).toEqual(withAnswers);
    expect(row.result_payload.contentVersion).toBe("1.0.0");
  });

  it("保留了本地结果键，供结果路由查回", () => {
    const row = buildQuickResultRow({ resultKey: RESULT_KEY, ownerId: OWNER, result: payload() });
    expect(row.result_key).toBe(RESULT_KEY);
    expect(row.owner_id).toBe(OWNER);
    expect(isUuid(row.id)).toBe(true);
  });
});

describe("云端保存编排", () => {
  function harness(options: {
    signedIn: boolean;
    insert?: () => Promise<{ error: unknown }>;
    signedInThrows?: boolean;
  }) {
    const insert = vi.fn(options.insert ?? (() => Promise.resolve({ error: null })));
    const deps = {
      isSignedIn: options.signedInThrows
        ? (): Promise<boolean> => Promise.reject(new Error("session unavailable"))
        : (): Promise<boolean> => Promise.resolve(options.signedIn),
      insert
    };
    const save = createQuickResultSaver(deps);
    return { insert, save };
  }

  it("未登录时不发起写入，返回 skipped", async () => {
    const { insert, save } = harness({ signedIn: false });
    await expect(save({ resultKey: RESULT_KEY, ownerId: OWNER, result: payload() })).resolves.toBe("skipped");
    expect(insert).not.toHaveBeenCalled();
  });

  it("已登录且写入成功时返回 saved", async () => {
    const { insert, save } = harness({ signedIn: true });
    await expect(save({ resultKey: RESULT_KEY, ownerId: OWNER, result: payload() })).resolves.toBe("saved");
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("写入返回错误时返回 failed，而不是抛错", async () => {
    const { save } = harness({ signedIn: true, insert: () => Promise.resolve({ error: { message: "rls denied" } }) });
    await expect(save({ resultKey: RESULT_KEY, ownerId: OWNER, result: payload() })).resolves.toBe("failed");
  });

  it("写入抛异常（离线）时返回 failed，调用方仍能保住本地结果", async () => {
    const { save } = harness({ signedIn: true, insert: () => Promise.reject(new Error("offline")) });
    await expect(save({ resultKey: RESULT_KEY, ownerId: OWNER, result: payload() })).resolves.toBe("failed");
  });

  it("读取登录态本身失败时按未登录处理，不抛错", async () => {
    const { insert, save } = harness({ signedIn: false, signedInThrows: true });
    await expect(save({ resultKey: RESULT_KEY, ownerId: OWNER, result: payload() })).resolves.toBe("skipped");
    expect(insert).not.toHaveBeenCalled();
  });
});
