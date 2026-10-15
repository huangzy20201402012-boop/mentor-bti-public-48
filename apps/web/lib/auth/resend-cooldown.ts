/**
 * 验证码重发的冷却计算。
 *
 * 抽成纯函数是因为这里真正的难点不是计时，是边界的两个方向：冷却没走完
 * 不能放行，时钟异常时更不能放行。放在组件里就只能靠肉眼验，而这段代码
 * 唯一的职责恰好是「别让用户把服务端的邮件限流打满」。
 */

/**
 * Supabase 的邮件发送有按分钟计的限流，60 秒既挡得住连点，也不至于让一个
 * 真的没收到邮件的用户等太久。配合服务端返回的 rate_limited 一起兜底。
 */
export const RESEND_COOLDOWN_SECONDS = 60;

/**
 * 距离可以重新发送还剩几秒；0 表示现在就可以发。
 *
 * 传入 null 表示这一次会话里还没发过。时间戳无法解析时同样返回 0：把用户
 * 卡在一个永远不结束的倒计时里，比让他多发一次请求糟糕得多。
 */
export function secondsUntilResend(sentAtMs: number | null, nowMs: number): number {
  if (sentAtMs === null) return 0;
  if (!Number.isFinite(sentAtMs) || !Number.isFinite(nowMs)) return 0;

  // 时钟回拨（或两处取时来自不同的钟）会让 elapsed 变成负数。按「刚发出」
  // 处理，而不是放行——放行等于把冷却整个关掉，这是唯一一条会让用户狂点
  // 服务端的路径。
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - sentAtMs) / 1000));
  const remaining = RESEND_COOLDOWN_SECONDS - elapsedSeconds;
  return remaining > 0 ? remaining : 0;
}

/** 重发按钮上的文案。冷却中带剩余秒数，可发时是一句可点的说明。 */
export function resendLabel(secondsLeft: number): string {
  return secondsLeft > 0 ? `${secondsLeft} 秒后可重新发送` : "重新发送验证码";
}
