import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "重置密码 · Oxford Bot" },
      { name: "description", content: "为你的 Oxford Bot 账号设置新密码。" },
      { property: "og:title", content: "重置密码 · Oxford Bot" },
      { property: "og:description", content: "为你的 Oxford Bot 账号设置新密码。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
      setChecked(true);
    });
    const t = setTimeout(() => setChecked(true), 3000);
    return () => { data.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("密码至少 6 位");
    if (password !== confirm) return toast.error("两次输入的密码不一致");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error("重置失败：链接可能已过期，请重新申请");
    toast.success("密码已重置，正在进入 Oxford Bot");
    navigate({ to: "/chat", replace: true });
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background bg-glow px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src={logo} alt="Oxford Bot" width={56} height={56} className="size-14 rounded-2xl" />
          <h1 className="text-2xl font-semibold tracking-tight">设置新密码</h1>
        </div>
        {ready ? (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Input type="password" required minLength={6} placeholder="新密码（至少 6 位）" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl" />
            <Input type="password" required minLength={6} placeholder="再次输入新密码" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 rounded-xl" />
            <Button type="submit" disabled={loading} className="h-11 rounded-xl">{loading ? "请稍候…" : "保存新密码"}</Button>
          </form>
        ) : checked ? (
          <div className="flex flex-col items-center gap-4 text-center text-sm text-muted-foreground">
            <p>重置链接无效或已过期，请回到登录页重新申请。</p>
            <Button variant="outline" className="rounded-xl" onClick={() => navigate({ to: "/auth" })}>返回登录</Button>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">正在验证链接…</p>
        )}
      </div>
    </div>
  );
}
