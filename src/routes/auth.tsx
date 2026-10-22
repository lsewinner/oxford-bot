import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/chat", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const t = mode === "signup" ? "注册 · Oxford Bot" : "登录 · Oxford Bot";
    document.title = t;
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", t);
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === "signup") {
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

  const oauth = async (provider: "google" | "apple") => {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) toast.error("登录失败，请重试");
  };

  const normalizedPhone = () => {
    const digits = phone.replace(/[\s-]/g, "");
    if (digits.startsWith("+")) return digits;
    return `+86${digits.replace(/^0+/, "")}`;
  };

  const sendCode = async () => {
    const p = normalizedPhone();
    if (!/^\+\d{8,15}$/.test(p)) return toast.error("请输入正确的手机号");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: p });
    setLoading(false);
    if (error) return toast.error("验证码发送失败，请稍后重试");
    setCodeSent(true);
    toast.success("验证码已发送");
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone: normalizedPhone(), token: code.trim(), type: "sms" });
    setLoading(false);
    if (error) toast.error("验证码错误或已过期");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background bg-glow px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src={logo} alt="Oxford Bot" width={56} height={56} className="size-14 rounded-2xl" />
          <h1 className="text-2xl font-semibold tracking-tight">{mode === "signin" ? "欢迎回来" : "创建账号"}</h1>
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
            {method === "phone" ? (
              <form onSubmit={verifyCode} className="flex flex-col gap-3">
                <Input
                  type="tel"
                  required
                  placeholder="手机号（默认 +86）"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 rounded-xl"
                />
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    placeholder="验证码"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                  <Button type="button" variant="outline" disabled={loading} onClick={sendCode} className="h-11 shrink-0 rounded-xl">
                    {codeSent ? "重新发送" : "获取验证码"}
                  </Button>
                </div>
                <Button type="submit" disabled={loading || !codeSent || !code} className="h-11 rounded-xl">
                  {loading ? "请稍候…" : "登录 / 注册"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">新手机号验证后自动创建账号</p>
              </form>
            ) : (
              <></>
            )}
            {method === "email" && (<></>)}
            <form onSubmit={submit} className="flex flex-col gap-3">
              <Input
                type="email"
                required
                placeholder="邮箱"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl"
              />
              <Input
                type="password"
                required
                minLength={6}
                placeholder="密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl"
              />
              <Button type="submit" disabled={loading} className="h-11 rounded-xl">
                {loading ? "请稍候…" : mode === "signin" ? "登录" : "注册"}
              </Button>
            </form>
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
          </>
        )}
      </div>
    </div>
  );
}
