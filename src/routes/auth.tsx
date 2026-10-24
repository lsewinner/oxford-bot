import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { PHONE_SIGNIN_ENABLED, normalizePhone, phoneAuthError } from "@/lib/phone-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "登录 · Oxford Bot" },
      { name: "description", content: "登录 Oxford Bot，在手机和电脑间同步你的对话。" },
      { property: "og:title", content: "登录 · Oxford Bot" },
      { property: "og:description", content: "登录 Oxford Bot，在手机和电脑间同步你的对话。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [method, setMethod] = useState<"phone" | "email">(PHONE_SIGNIN_ENABLED ? "phone" : "email");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sentPhone, setSentPhone] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const phonePending = useRef(false);

  // Hide the form until we know the visitor is signed out, so a Safari back-swipe never flashes it.
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    const check = () => supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat", replace: true });
      else setChecked(true);
    });
    void check();
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/chat", replace: true });
    });
    // Safari back-swipe restores this page from cache; send signed-in users straight back.
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setChecked(false); void check(); };
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    window.addEventListener("pageshow", onShow);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("pageshow", onShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [navigate]);

  useEffect(() => {
    const t = mode === "signup" ? "注册 · Oxford Bot" : "登录 · Oxford Bot";
    document.title = t;
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", t);
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (forgot) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) toast.error("发送失败，请稍后重试");
      else setResetSent(true);
    } else if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) toast.error(error.message);
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("邮箱或密码错误");
    }
    setLoading(false);
  };

  // Inside the Expo iOS app, hand OAuth to the native ASWebAuthenticationSession and
  // receive the session back via injected window.postMessage.
  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (event.source !== window) return;
      let data: { type?: string; access_token?: string; refresh_token?: string; error?: string } | null = null;
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data?.type === "NATIVE_OAUTH_ERROR") { toast.error("登录未完成，请重试"); return; }
      if (data?.type !== "NATIVE_OAUTH_SUCCESS" || typeof data.access_token !== "string" || typeof data.refresh_token !== "string") return;
      const { error } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      if (error) toast.error("登录失败，请重试");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const oauth = async (provider: "google" | "apple") => {
    const rn = (window as unknown as { ReactNativeWebView?: { postMessage: (m: string) => void } }).ReactNativeWebView;
    if (rn) {
      rn.postMessage(JSON.stringify({ type: "NATIVE_OAUTH", provider }));
      return;
    }
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) toast.error("登录失败，请重试");
  };

  const sendCode = async () => {
    if (phonePending.current) return;
    const p = normalizePhone(phone);
    if (!p) { setPhoneError("请输入正确的手机号；海外号码请带国家区号，例如 +44。"); return; }
    phonePending.current = true;
    setPhoneError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: p });
      if (error) { setPhoneError(phoneAuthError(error, "send").message); return; }
      setSentPhone(p);
      setCodeSent(true);
      toast.success("验证码已发送");
    } catch (error) {
      setPhoneError(phoneAuthError(error, "send").message);
    } finally {
      phonePending.current = false;
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phonePending.current || !sentPhone || sentPhone !== normalizePhone(phone)) return;
    phonePending.current = true;
    setPhoneError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: sentPhone, token: code.trim(), type: "sms" });
      if (error) setPhoneError(phoneAuthError(error, "verify").message);
    } catch (error) {
      setPhoneError(phoneAuthError(error, "verify").message);
    } finally {
      phonePending.current = false;
      setLoading(false);
    }
  };

  if (!checked) return <div className="min-h-dvh bg-background bg-glow" aria-busy="true" />;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background bg-glow px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src={logo} alt="Oxford Bot" width={56} height={56} className="size-14 rounded-2xl" />
          <h1 className="text-2xl font-semibold tracking-tight">{forgot ? "找回密码" : mode === "signin" ? "欢迎回来" : "创建账号"}</h1>
          <p className="text-sm text-muted-foreground">对话会保存在云端，多设备同步</p>
        </div>

        {sent ? (
          <div className="rounded-2xl border border-border bg-card p-5 text-center text-sm">
            确认邮件已发送到 <span className="font-medium">{email}</span>，点击邮件中的链接即可完成注册。
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => oauth("apple")}>
                使用 Apple 继续
              </Button>
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => oauth("google")}>
                使用 Google 继续
              </Button>
            </div>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" /> 或 <div className="h-px flex-1 bg-border" />
            </div>
            {PHONE_SIGNIN_ENABLED && (
              <div className="mb-3 grid grid-cols-2 rounded-xl border border-border p-1 text-sm">
                {(["phone", "email"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`rounded-lg py-2 ${method === m ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                  >
                    {m === "phone" ? "手机号" : "邮箱"}
                  </button>
                ))}
              </div>
            )}
            {PHONE_SIGNIN_ENABLED && method === "phone" ? (
              <form onSubmit={verifyCode} className="flex flex-col gap-3">
                <Input
                  type="tel"
                  required
                  placeholder="手机号（默认 +86）"
                  aria-label="手机号"
                  autoComplete="tel"
                  disabled={loading}
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setSentPhone(null);
                    setCodeSent(false);
                    setCode("");
                    setPhoneError(null);
                  }}
                  className="h-11 rounded-xl"
                />
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    placeholder="验证码"
                    aria-label="验证码"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  <Button type="button" variant="outline" disabled={loading} onClick={sendCode} className="h-11 shrink-0 rounded-xl">
                    {codeSent ? "重新发送" : "获取验证码"}
                  </Button>
                </div>
                {phoneError && (
                  <div role="alert" className="border-l-2 border-destructive pl-3 text-sm leading-6 text-foreground">
                    <p>{phoneError}</p>
                    <Button type="button" variant="link" className="h-auto px-0 py-1" disabled={loading} onClick={() => { setMethod("email"); setPhoneError(null); }}>
                      改用邮箱登录 / 注册
                    </Button>
                  </div>
                )}
                <Button type="submit" disabled={loading || !codeSent || !code} className="h-11 rounded-xl">
                  {loading ? "请稍候…" : "登录 / 注册"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">新手机号验证后自动创建账号</p>
              </form>
            ) : (
              <>
                <form onSubmit={submit} className="flex flex-col gap-3">
                  <Input
                    type="email"
                    required
                    placeholder="邮箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  {!forgot && (
                    <Input
                      type="password"
                      required
                      minLength={6}
                      placeholder="密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  )}
                  {resetSent && (
                    <p role="status" className="text-sm leading-6 text-foreground">
                      重置邮件已发送到 {email}，请点击邮件中的链接设置新密码（也请检查垃圾邮件）。
                    </p>
                  )}
                  <Button type="submit" disabled={loading} className="h-11 rounded-xl">
                    {loading ? "请稍候…" : forgot ? (resetSent ? "重新发送" : "发送重置邮件") : mode === "signin" ? "登录" : "注册"}
                  </Button>
                  {mode === "signin" && (
                    <button
                      type="button"
                      className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      onClick={() => { setForgot(!forgot); setResetSent(false); }}
                    >
                      {forgot ? "返回登录" : "忘记密码？"}
                    </button>
                  )}
                </form>
                {!forgot && (
                <p className="mt-5 text-center text-sm text-muted-foreground">
                  {mode === "signin" ? "还没有账号？" : "已有账号？"}
                  <button
                    type="button"
                    className="ml-1 text-foreground underline-offset-4 hover:underline"
                    onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                  >
                    {mode === "signin" ? "注册" : "登录"}
                  </button>
                </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
