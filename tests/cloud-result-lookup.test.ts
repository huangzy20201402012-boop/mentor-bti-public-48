import { describe, expect, it } from "vitest";
import {
  fetchOwnCloudQuickResult,
  type CloudResultLookupDependencies
} from "../apps/web/lib/cloud/result-lookup";

const OWNER = "8c1d0b6a-2e34-4f77-9a10-5b6c7d8e9f01";
const RESULT_KEY = "quick-1a2b3c";

function row(contentVersion: string, payload: Record<string, unknown> = {}): Record<string, unknown> {
  return { content_version: contentVersion, result_payload: { contentVersion, typeCode: "EDSC", ...payload } };
}

describe("云端结果回取", () => {
  function harness(options: {
    userId?: string | null;
    data?: unknown;
    error?: unknown;
    throws?: boolean;
    userThrows?: boolean;
  }) {
    const queries: Array<{ ownerId: string; resultKey: string }> = [];
    const deps: CloudResultLookupDependencies = {
      currentUserId: async () => {
        if (options.userThrows) throw new Error("session unavailable");
        return options.userId === undefined ? OWNER : options.userId;
      },
      findOwn: async (ownerId: string, resultKey: string) => {
        queries.push({ ownerId, resultKey });
        if (options.throws) throw new Error("offline");
        return { data: options.data ?? [], error: options.error ?? null };
      }
    };
    return { queries, lookup: (contentVersion: string) =>
      fetchOwnCloudQuickResult(deps, { resultKey: RESULT_KEY, contentVersion }) };
  }

  it("找到版本一致的结果时返回 payload", async () => {
    const { lookup } = harness({ data: [row("1.0.0")] });
    await expect(lookup("1.0.0")).resolves.toEqual({ contentVersion: "1.0.0", typeCode: "EDSC" });
  });

  it("按 owner 与 result_key 一起查，不只靠 RLS", async () => {
    const { queries, lookup } = harness({ data: [row("1.0.0")] });
    await lookup("1.0.0");
    expect(queries).toEqual([{ ownerId: OWNER, resultKey: RESULT_KEY }]);
  });

  it("版本不一致时返回 null——不能拿旧题库的结果冒充当前结果", async () => {
    const { lookup } = harness({ data: [row("0.9.0")] });
    await expect(lookup("1.0.0")).resolves.toBeNull();
  });

  it("数据库版本列与当前题库不一致时返回 null", async () => {
    const { lookup } = harness({ data: [{ content_version: "0.9.0", result_payload: { contentVersion: "1.0.0", typeCode: "EDSC" } }] });
    await expect(lookup("1.0.0")).resolves.toBeNull();
  });

  it("未登录时不查询，返回 null", async () => {
    const { queries, lookup } = harness({ userId: null, data: [row("1.0.0")] });
    await expect(lookup("1.0.0")).resolves.toBeNull();
    expect(queries).toHaveLength(0);
  });

  it("查询报错时返回 null，而不是抛错", async () => {
    const { lookup } = harness({ error: { message: "rls denied" } });
    await expect(lookup("1.0.0")).resolves.toBeNull();
  });

  it("查询抛异常（离线）时返回 null", async () => {
    const { lookup } = harness({ throws: true });
    await expect(lookup("1.0.0")).resolves.toBeNull();
  });

  it("读取登录态失败时返回 null，不查询", async () => {
    const { queries, lookup } = harness({ userThrows: true });
    await expect(lookup("1.0.0")).resolves.toBeNull();
    expect(queries).toHaveLength(0);
  });

  it("没有匹配行时返回 null", async () => {
    const { lookup } = harness({ data: [] });
    await expect(lookup("1.0.0")).resolves.toBeNull();
  });

  it("payload 不是对象时返回 null，不让脏数据进入结果页", async () => {
    const { lookup } = harness({ data: [{ content_version: "1.0.0", result_payload: "nope" }] });
    await expect(lookup("1.0.0")).resolves.toBeNull();
  });

  it("payload 缺少 contentVersion 时返回 null——版本必须能被独立核对", async () => {
    const { lookup } = harness({ data: [{ content_version: "1.0.0", result_payload: { typeCode: "EDSC" } }] });
    await expect(lookup("1.0.0")).resolves.toBeNull();
  });
});
