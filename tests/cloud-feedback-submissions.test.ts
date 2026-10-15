import { describe, expect, it } from "vitest";
import {
  FEEDBACK_MESSAGE_MAX_LENGTH,
  submitFeedbackToCloud,
  validateFeedbackSubmission,
  type FeedbackSubmissionDependencies,
  type FeedbackSubmissionRow
} from "../apps/web/lib/cloud/feedback-submissions";

const OWNER = "8c1d0b6a-2e34-4f77-9a10-5b6c7d8e9f01";

describe("反馈输入校验", () => {
  it("合法输入通过，并去掉首尾空白", () => {
    const result = validateFeedbackSubmission({ category: "bug", message: "  结果页在微信里被截断了  " });
    expect(result).toEqual({ ok: true, value: { category: "bug", message: "结果页在微信里被截断了" } });
  });

  it("保留正文内部的换行", () => {
    const result = validateFeedbackSubmission({ category: "suggestion", message: "第一行\n第二行" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.message).toBe("第一行\n第二行");
  });

  it("空串或纯空白按空反馈拒绝", () => {
    expect(validateFeedbackSubmission({ category: "bug", message: "" })).toEqual({ ok: false, reason: "message_empty" });
    expect(validateFeedbackSubmission({ category: "bug", message: "   \n  " })).toEqual({ ok: false, reason: "message_empty" });
  });

  it("长度边界：等于上限通过，超出上限拒绝", () => {
    const atLimit = "字".repeat(FEEDBACK_MESSAGE_MAX_LENGTH);
    const overLimit = "字".repeat(FEEDBACK_MESSAGE_MAX_LENGTH + 1);
    expect(validateFeedbackSubmission({ category: "content", message: atLimit }).ok).toBe(true);
    expect(validateFeedbackSubmission({ category: "content", message: overLimit })).toEqual({
      ok: false,
      reason: "message_too_long"
    });
  });

  it("未知分类被拒绝", () => {
    expect(validateFeedbackSubmission({ category: "complaint", message: "有效正文" })).toEqual({
      ok: false,
      reason: "category"
    });
  });

  it("四个允许的分类都通过", () => {
    for (const category of ["bug", "suggestion", "content", "other"]) {
      expect(validateFeedbackSubmission({ category, message: "有效正文" }).ok).toBe(true);
    }
  });
});

describe("反馈提交编排", () => {
  function harness(options: {
    signedIn: boolean;
    insertError?: unknown;
    insertThrows?: boolean;
    signedInThrows?: boolean;
  }) {
    const inserted: FeedbackSubmissionRow[] = [];
    let signedInReads = 0;
    const deps: FeedbackSubmissionDependencies = {
      isSignedIn: async (): Promise<boolean> => {
        signedInReads += 1;
        if (options.signedInThrows) throw new Error("session unavailable");
        return options.signedIn;
      },
      insert: async (row: FeedbackSubmissionRow): Promise<{ error: unknown }> => {
        inserted.push(row);
        if (options.insertThrows) throw new Error("offline");
        return { error: options.insertError ?? null };
      }
    };
    return {
      inserted,
      signedInReads: () => signedInReads,
      submit: (input: { category: string; message: string }) =>
        submitFeedbackToCloud(deps, { ownerId: OWNER, ...input })
    };
  }

  it("未登录时不发起写入，返回 skipped", async () => {
    const { inserted, submit } = harness({ signedIn: false });
    await expect(submit({ category: "bug", message: "有效正文" })).resolves.toBe("skipped");
    expect(inserted).toHaveLength(0);
  });

  it("输入非法时返回 invalid，且不读登录态、不写库", async () => {
    const { inserted, signedInReads, submit } = harness({ signedIn: true });
    await expect(submit({ category: "bug", message: "   " })).resolves.toBe("invalid");
    expect(signedInReads()).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it("已登录且写入成功时返回 saved，且提交的是裁剪后的正文", async () => {
    const { inserted, submit } = harness({ signedIn: true });
    await expect(submit({ category: "content", message: "  题目第 12 题有错别字  " })).resolves.toBe("saved");
    expect(inserted).toEqual([{ owner_id: OWNER, category: "content", message: "题目第 12 题有错别字" }]);
  });

  it("写入返回错误时返回 failed，而不是抛错", async () => {
    const { submit } = harness({ signedIn: true, insertError: { message: "rls denied" } });
    await expect(submit({ category: "other", message: "有效正文" })).resolves.toBe("failed");
  });

  it("写入抛异常（离线）时返回 failed", async () => {
    const { submit } = harness({ signedIn: true, insertThrows: true });
    await expect(submit({ category: "other", message: "有效正文" })).resolves.toBe("failed");
  });

  it("读取登录态失败时按未登录处理，不抛错", async () => {
    const { inserted, submit } = harness({ signedIn: false, signedInThrows: true });
    await expect(submit({ category: "other", message: "有效正文" })).resolves.toBe("skipped");
    expect(inserted).toHaveLength(0);
  });

  it("提交行只含三个约定字段，不夹带身份信息", async () => {
    const { inserted, submit } = harness({ signedIn: true });
    await submit({ category: "bug", message: "有效正文" });
    expect(Object.keys(inserted[0]!).sort()).toEqual(["category", "message", "owner_id"]);
  });
});
