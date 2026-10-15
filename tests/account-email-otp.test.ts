import { describe, expect, it } from "vitest";
import { isValidOtpToken, normalizeEmail } from "../apps/web/lib/auth/email-otp";

describe("邮箱规范化", () => {
  it("去掉首尾空白并统一小写", () => {
    expect(normalizeEmail("  Mentor@Example.COM ")).toBe("mentor@example.com");
  });

  it("接受常见的合法邮箱", () => {
    expect(normalizeEmail("a.b+tag@sub.example.co")).toBe("a.b+tag@sub.example.co");
  });

  it("空串与纯空白按非法处理", () => {
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail("   ")).toBeNull();
  });

  it("缺少 @ 或域名不含点时按非法处理", () => {
    expect(normalizeEmail("mentor.example.com")).toBeNull();
    expect(normalizeEmail("mentor@localhost")).toBeNull();
    expect(normalizeEmail("@example.com")).toBeNull();
    expect(normalizeEmail("mentor@")).toBeNull();
  });

  it("内部含空白按非法处理", () => {
    expect(normalizeEmail("men tor@example.com")).toBeNull();
  });

  it("超过 254 字符按非法处理", () => {
    const long = `${"a".repeat(250)}@example.com`;
    expect(normalizeEmail(long)).toBeNull();
  });

  it("已规范化的邮箱再次规范化保持不变", () => {
    const once = normalizeEmail(" Mentor@Example.com ");
    expect(once).not.toBeNull();
    expect(normalizeEmail(once as string)).toBe(once);
  });
});

describe("一次性验证码格式", () => {
  it("接受 6 到 8 位数字", () => {
    expect(isValidOtpToken("123456")).toBe(true);
    expect(isValidOtpToken("1234567")).toBe(true);
    expect(isValidOtpToken("12345678")).toBe(true);
  });

  it("忽略首尾空白", () => {
    expect(isValidOtpToken("  123456 ")).toBe(true);
  });

  it("位数不足或过多按非法处理", () => {
    expect(isValidOtpToken("12345")).toBe(false);
    expect(isValidOtpToken("123456789")).toBe(false);
  });

  it("含非数字字符按非法处理", () => {
    expect(isValidOtpToken("12345a")).toBe(false);
    expect(isValidOtpToken("12 3456")).toBe(false);
    expect(isValidOtpToken("")).toBe(false);
  });
});
