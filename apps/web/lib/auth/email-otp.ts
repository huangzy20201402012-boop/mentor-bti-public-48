/**
 * 邮箱与一次性验证码的前置校验。
 *
 * 这一层只负责「明显非法的输入不要发到网络上」，真实校验始终由 Supabase Auth
 * 负责。所以规则刻意保守——不做 RFC 5322 全量解析，也不试图替服务端判断
 * 邮箱是否真的存在。放宽或收紧这里都不改变安全边界。
 */

const EMAIL_MAX_LENGTH = 254;
const OTP_MIN_DIGITS = 6;
const OTP_MAX_DIGITS = 8;
const OTP_PATTERN = new RegExp(`^[0-9]{${OTP_MIN_DIGITS},${OTP_MAX_DIGITS}}$`);

/**
 * 返回规范化后的邮箱，非法时返回 null。规范化 = 去首尾空白 + 转小写：
 * 用户在不同设备上输入的大小写不应产生两个不同的账户。
 */
export function normalizeEmail(raw: string): string | null {
  const candidate = raw.trim().toLowerCase();
  if (candidate.length === 0 || candidate.length > EMAIL_MAX_LENGTH) return null;
  if (/\s/.test(candidate)) return null;

  const at = candidate.indexOf("@");
  if (at <= 0 || at !== candidate.lastIndexOf("@")) return null;

  const domain = candidate.slice(at + 1);
  const dot = domain.indexOf(".");
  // 域名必须有点且不在首尾：挡掉 "mentor@localhost" 这类本地地址，它们在
  // 生产环境收不到验证码，早点拒绝比让用户等一封永远不来的邮件好。
  if (dot <= 0 || dot === domain.length - 1) return null;

  return candidate;
}

/** Supabase 的邮件验证码是若干位数字；位数可配置，因此接受 6–8 位。 */
export function isValidOtpToken(raw: string): boolean {
  return OTP_PATTERN.test(raw.trim());
}
