import { describe, expect, it } from "vitest";
import {
  fetchOwnQuickResults,
  normalizeQuickResultRows,
  type AccountResultDependencies
} from "../apps/web/lib/cloud/account-results";

const OWNER = "8c1d0b6a-2e34-4f77-9a10-5b6c7d8e9f01";
const RESULT_ID = "3f2a1c4e-9b77-4a1e-8f21-0d5c6b7a8e90";

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: RESULT_ID,
    result_key: "quick-1a2b3c",
    content_version: "1.0.0",
    created_at: "2026-10-06T09:30:00.000Z",
    result_payload: { contentVersion: "1.0.0", typeCode: "EDSC", personality: { domain: "ED" } },
    ...overrides
  };
}

describe("账户结果行归一化", () => {
  it("取出列表需要的字段", () => {
    expect(normalizeQuickResultRows([row()])).toEqual([
      {
        id: RESULT_ID,
        resultKey: "quick-1a2b3c",
        contentVersion: "1.0.0",
        createdAt: "2026-10-06T09:30:00.000Z",
        typeCode: "EDSC",
        domainCode: "ED"
      }
    ]);
  });

  it("版本取自列，而不是 payload——列是权威", () => {
    // 两者本应一致（迁移里有 check 约束），但展示必须只听一个来源，
    // 否则约束被绕过时页面会显示两个互相矛盾的版本号。
    const [result] = normalizeQuickResultRows([
      row({ content_version: "1.0.0", result_payload: { contentVersion: "0.9.0", typeCode: "EDSC" } })
    ]);
    expect(result?.contentVersion).toBe("1.0.0");
  });

  it("payload 缺字段时降级为 null，而不是丢掉整行", () => {
    const [result] = normalizeQuickResultRows([row({ result_payload: { contentVersion: "1.0.0" } })]);
    expect(result?.typeCode).toBeNull();
    expect(result?.domainCode).toBeNull();
  });

  it("缺少主键或创建时间的行被丢弃", () => {
    const rows = normalizeQuickResultRows([
      row({ id: null }),
      row({ created_at: undefined }),
      row({ id: 42 }),
      row({ created_at: "" })
    ]);
    expect(rows).toHaveLength(0);
  });

  it("非数组输入返回空列表而不是抛错", () => {
    expect(normalizeQuickResultRows(null)).toEqual([]);
    expect(normalizeQuickResultRows({})).toEqual([]);
    expect(normalizeQuickResultRows("nope")).toEqual([]);
  });

  it("数组里的非对象项被跳过，合法的仍然保留", () => {
    const rows = normalizeQuickResultRows([null, "nope", 7, row()]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(RESULT_ID);
  });

  it("保留传入顺序——服务端已按时间倒序", () => {
    const second = "11111111-2222-4333-8444-555555555555";
    const rows = normalizeQuickResultRows([row(), row({ id: second })]);
    expect(rows.map((item) => item.id)).toEqual([RESULT_ID, second]);
  });
});

describe("账户结果读取编排", () => {
  function harness(options: {
    userId: string | null;
    data?: unknown;
    error?: unknown;
    throws?: boolean;
    userThrows?: boolean;
  }) {
    const listedOwners: string[] = [];
    let userReads = 0;
    const deps: AccountResultDependencies = {
      currentUserId: async () => {
        userReads += 1;
        if (options.userThrows) throw new Error("session unavailable");
        return options.userId;
      },
      list: async (ownerId: string) => {
        listedOwners.push(ownerId);
        if (options.throws) throw new Error("offline");
        return { data: options.data ?? [], error: options.error ?? null };
      }
    };
    return { listedOwners, userReads: () => userReads, fetchResults: () => fetchOwnQuickResults(deps) };
  }

  it("未登录时不查询，返回 signed_out", async () => {
    const { listedOwners, fetchResults } = harness({ userId: null });
    await expect(fetchResults()).resolves.toEqual({ outcome: "signed_out", results: [] });
    expect(listedOwners).toHaveLength(0);
  });

  it("已登录时按自己的 owner id 查询，返回 ok", async () => {
    const { listedOwners, fetchResults } = harness({ userId: OWNER, data: [row()] });
    const snapshot = await fetchResults();
    expect(listedOwners).toEqual([OWNER]);
    expect(snapshot.outcome).toBe("ok");
    expect(snapshot.results).toHaveLength(1);
  });

  it("查询返回错误时返回 unavailable，而不是「你没有结果」", async () => {
    const { fetchResults } = harness({ userId: OWNER, error: { message: "rls denied" } });
    await expect(fetchResults()).resolves.toEqual({ outcome: "unavailable", results: [] });
  });

  it("查询抛异常（离线）时返回 unavailable", async () => {
    const { fetchResults } = harness({ userId: OWNER, throws: true });
    await expect(fetchResults()).resolves.toEqual({ outcome: "unavailable", results: [] });
  });

  it("读取登录态失败时按未登录处理，不查询", async () => {
    const { listedOwners, fetchResults } = harness({ userId: OWNER, userThrows: true });
    await expect(fetchResults()).resolves.toEqual({ outcome: "signed_out", results: [] });
    expect(listedOwners).toHaveLength(0);
  });

  it("服务端返回脏数据时仍给出可用列表", async () => {
    const { fetchResults } = harness({ userId: OWNER, data: [row(), null, { id: "x" }] });
    const snapshot = await fetchResults();
    expect(snapshot.outcome).toBe("ok");
    expect(snapshot.results).toHaveLength(1);
  });

  /**
   * 这条是这一组的存在理由：「查到了、确实没有」和「没查到」必须是两个不同的
   * 结果。以前两者都收敛成空数组，于是断网时账户页会告诉用户「登录之后完成的
   * 48 题结果会出现在这里」——把一次读取失败说成了「你没有结果」。
   */
  it("查询成功但没有记录时是 ok + 空列表，与读取失败不同", async () => {
    const { fetchResults } = harness({ userId: OWNER, data: [] });
    await expect(fetchResults()).resolves.toEqual({ outcome: "ok", results: [] });
  });
});
