export function normalizePhone(value: string): string | null {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  const phone = international.startsWith("+") ? international : `+86${international}`;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) return null;
  if (phone.startsWith("+86") && !/^\+861[3-9]\d{9}$/.test(phone)) return null;
  return phone;
}

export function phoneAuthError(error: unknown, phase: "send" | "verify") {
  const value = error && typeof error === "object" ? error as { message?: string; code?: string; status?: number } : {};
  const message = typeof value.message === "string" ? value.message : "";
  if (/60220|messages to china require use case vetting/i.test(message)) {
    return { kind: "china_approval", message: "中国大陆短信通道尚未获短信服务商批准，暂时无法发送验证码。请改用邮箱登录或注册；重复发送或开启 VPN 都不能解除此限制。" };
  }
  if (/60605|geo.?permissions|country.*blocked|region.*blocked/i.test(message)) {
    return { kind: "geo_block", message: "短信服务商未开放向该国家或地区发送验证码，请改用邮箱登录，并联系 Oxford Bot 管理员检查短信发送地区设置。" };
  }
  if (value.status === 429 || /rate.?limit|too many|over_sms_send_rate_limit/i.test(`${value.code} ${message}`)) {
    return { kind: "rate_limit", message: "验证码请求过于频繁，请稍后再试，或改用邮箱登录。" };
  }
  if (/fetch|network|timeout|connection/i.test(message) || error instanceof TypeError) {
    return { kind: "network", message: "未能连接登录服务，请检查网络后重试；若已收到短信，请直接输入验证码。" };
  }
  if (value.code === "phone_provider_disabled" || /phone.*disabled|unsupported.*phone|sms.*not.*configured/i.test(message)) {
    return { kind: "configuration", message: "手机号登录服务暂未配置完成，请改用邮箱登录或注册。" };
  }
  if (phase === "verify") {
    return { kind: "verification", message: "验证码错误或已过期，请检查验证码，或重新获取后再试。" };
  }
  return { kind: "provider", message: "短信服务暂时无法发送验证码，请稍后重试或改用邮箱登录；若持续失败，请联系 Oxford Bot 管理员检查短信服务。" };
}