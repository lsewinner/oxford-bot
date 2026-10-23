import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftIcon, RotateCcwIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { checkAdmin, loadAdminData, runAdminAction, type AdminAction, type AdminAuditRow } from "@/lib/admin.functions";
import { FREE_DAILY_MESSAGES, PRO_DAILY_MESSAGES, PAID_PRO_DAILY_MESSAGES, ULTRA_DAILY_MESSAGES } from "@/lib/quota";
import { cn } from "@/lib/utils";
import { MemoryCenter } from "@/components/admin/memory-center";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "管理后台 · Oxford Bot" },
      { name: "description", content: "Oxford Bot 管理后台：用户、额度、会员与操作日志。" },
      { property: "og:title", content: "管理后台 · Oxford Bot" },
      { property: "og:description", content: "Oxford Bot 管理后台：用户、额度、会员与操作日志。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const ACTION_LABEL: Record<string, string> = {
  memory_save: "保存记忆版本", memory_publish: "发布/回滚记忆", memory_unpublish: "停用记忆",
  reset_all: "重置全部今日额度", reset_usage: "重置今日额度", set_limit: "设置每日额度",
  grant_pro: "授予会员等级", revoke_pro: "收回授予等级", ban: "停用账号", unban: "恢复账号",
};
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("zh-CN", { hour12: false }) : "—");

type AdminUser = Awaited<ReturnType<typeof loadAdminData>>["users"][number];

function AdminPage() {
  const check = useServerFn(checkAdmin);
  const load = useServerFn(loadAdminData);
  const run = useServerFn(runAdminAction);
  const qc = useQueryClient();
  const role = useQuery({ queryKey: ["admin-check"], queryFn: () => check() });
  const data = useQuery({ queryKey: ["admin-data"], queryFn: () => load(), enabled: role.data?.isAdmin === true });
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"users" | "audit" | "memory">("users");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const act = useMutation({
    mutationFn: (a: AdminAction) => run({ data: a }),
    onSuccess: (_r, a) => { toast.success(`${ACTION_LABEL[a.type]}：已完成`); void qc.invalidateQueries({ queryKey: ["admin-data"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "操作失败"),
  });
  const users = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data.data?.users ?? []).filter((u) => !s || u.email.toLowerCase().includes(s) || u.nickname.toLowerCase().includes(s));
  }, [data.data, q]);
  const current = editing ? data.data?.users.find((u) => u.id === editing.id) ?? editing : null;

  if (role.isLoading) return <Center>正在验证权限…</Center>;
  if (!role.data?.isAdmin) return <Center>你没有管理后台的访问权限。<Link to="/chat" className="mt-4 underline">返回对话</Link></Center>;

  const o = data.data?.overview;
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8">
        <Link to="/chat" aria-label="返回对话" className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" /></Link>
        <h1 className="text-base font-semibold">管理后台</h1>
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">SUPER ADMIN</span>
        <div className="ml-auto">
          <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => { if (confirm("确定重置所有用户今天已用的消息额度？")) act.mutate({ type: "reset_all" }); }}>
            <RotateCcwIcon className="size-3.5" />重置全部额度
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[["总用户", o?.totalUsers], ["Pro 用户", o?.proUsers], ["今日活跃", o?.activeToday], ["今日消息", o?.messagesToday], ["已停用", o?.bannedUsers]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">{l}</div>
              <div className="mt-1 font-mono text-2xl font-semibold">{v ?? "—"}</div>
            </div>
          ))}
        </section>
        <p className="mt-3 text-xs text-muted-foreground">默认每日额度：免费 {FREE_DAILY_MESSAGES} 条，付费 Pro {PAID_PRO_DAILY_MESSAGES} 条，授予 Pro {PRO_DAILY_MESSAGES} 条，Ultra {ULTRA_DAILY_MESSAGES} 条（UTC 0 点重置）。</p>

        <div className="mt-6 flex items-center gap-2">
          {(["users", "audit", "memory"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={cn("rounded-lg px-3 py-1.5 text-sm", tab === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t === "users" ? "用户" : t === "audit" ? "操作日志" : "记忆中心"}
            </button>
          ))}
          {tab === "users" && (
            <div className="relative ml-auto w-full max-w-xs">
              <SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索邮箱或昵称" className="h-9 pl-8" />
            </div>
          )}
        </div>

        {tab === "memory" ? <MemoryCenter /> : data.isLoading ? <p className="mt-6 text-sm text-muted-foreground">加载中…</p> : data.error ? <p className="mt-6 text-sm text-destructive">读取失败，请刷新重试</p> : tab === "users" ? (
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-card text-left text-xs text-muted-foreground">
                <tr><th className="px-4 py-2.5 font-medium">用户</th><th className="px-4 py-2.5 font-medium">会员</th><th className="px-4 py-2.5 font-medium">今日额度</th><th className="px-4 py-2.5 font-medium">注册时间</th><th className="px-4 py-2.5 font-medium">状态</th><th /></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3"><div className="font-medium">{u.nickname || u.email.split("@")[0]}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
                    <td className="px-4 py-3">{u.isPro ? <span className="rounded bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">{u.tier === "ultra" ? "ULTRA" : "PRO"}{u.grantedPro && !u.paidPro ? " · 授予" : ""}</span> : <span className="text-muted-foreground">Free</span>}</td>
                    <td className="px-4 py-3 font-mono">{u.usedToday} / {u.dailyLimit}{u.dailyLimitOverride !== null && <span className="ml-1 text-[10px] text-muted-foreground">自定义</span>}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmt(u.createdAt)}</td>
                    <td className="px-4 py-3">{u.banned ? <span className="text-destructive">已停用</span> : <span className="text-muted-foreground">正常</span>}</td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(u)}>管理</Button></td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">没有匹配的用户</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-border rounded-xl border border-border">
            {(data.data?.audit ?? []).map((a: AdminAuditRow) => (
              <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className="font-medium">{ACTION_LABEL[a.action] ?? a.action}</span>
                {a.target && <span className="text-muted-foreground">→ {a.target}</span>}
                {a.details && Object.keys(a.details).length > 0 && <span className="font-mono text-xs text-muted-foreground">{JSON.stringify(a.details)}</span>}
                <span className="ml-auto text-xs text-muted-foreground">{fmt(a.createdAt)}</span>
              </div>
            ))}
            {(data.data?.audit ?? []).length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">暂无操作记录</p>}
          </div>
        )}
      </main>
      <UserDialog user={current} onClose={() => setEditing(null)} busy={act.isPending} onAction={(a) => act.mutate(a)} />
    </div>
  );
}

function UserDialog({ user, onClose, onAction, busy }: { user: AdminUser | null; onClose: () => void; onAction: (a: AdminAction) => void; busy: boolean }) {
  const [limit, setLimit] = useState("");
  const [until, setUntil] = useState("");
  const [tier, setTier] = useState<"pro" | "ultra">("pro");
  if (!user) return null;
  const id = user.id;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) { onClose(); setLimit(""); setUntil(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="truncate">{user.email}</DialogTitle></DialogHeader>
        <div className="space-y-5 text-sm">
          <Block title="每日消息额度" note={`今日已用 ${user.usedToday} / ${user.dailyLimit}${user.dailyLimitOverride === null ? "（默认）" : "（自定义）"}`}>
            <div className="flex gap-2">
              <Input type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="新的每日条数" className="h-9" />
              <Button size="sm" disabled={busy || limit === ""} onClick={() => onAction({ type: "set_limit", userId: id, dailyLimit: Number(limit) })}>设置</Button>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction({ type: "reset_usage", userId: id })}>重置今日额度</Button>
              {user.dailyLimitOverride !== null && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction({ type: "set_limit", userId: id, dailyLimit: null })}>恢复默认</Button>}
            </div>
          </Block>
          <Block title="会员等级授予" note={(user.paidPro ? `已通过 Stripe 付费订阅 ${user.paidUltra ? "Ultra" : "Pro"}。` : "") + (user.grantedPro ? `已授予 ${user.grantedTier === "ultra" ? "Ultra" : "Pro"}，${user.proUntil ? `到期 ${fmt(user.proUntil)}` : "永久"}` : user.paidPro ? "" : "未授予")}>
            <div className="mb-2 flex gap-2">
              {(["pro", "ultra"] as const).map((t) => <Button key={t} size="sm" variant={tier === t ? "default" : "outline"} onClick={() => setTier(t)}>{t === "pro" ? `Pro · ${PRO_DAILY_MESSAGES}/天` : `Ultra · ${ULTRA_DAILY_MESSAGES}/天`}</Button>)}
            </div>
            <div className="flex gap-2">
              <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="h-9" aria-label="到期日，留空为永久" />
              <Button size="sm" disabled={busy} onClick={() => onAction({ type: "grant_pro", userId: id, until: until ? new Date(`${until}T23:59:59Z`).toISOString() : null, tier })}>{until ? "授予至该日" : "永久授予"}</Button>
            </div>
            {user.grantedPro && <Button size="sm" variant="ghost" className="mt-2" disabled={busy} onClick={() => onAction({ type: "revoke_pro", userId: id })}>收回授予的等级</Button>}
          </Block>
          <Block title="账号状态" note={user.banned ? "已停用：无法登录和对话" : `正常 · 最近登录 ${fmt(user.lastSignIn)}`}>
            {user.banned
              ? <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction({ type: "unban", userId: id })}>恢复账号</Button>
              : <Button size="sm" variant="destructive" disabled={busy} onClick={() => { if (confirm(`确定停用 ${user.email}？`)) onAction({ type: "ban", userId: id }); }}>停用账号</Button>}
          </Block>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Block({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-border p-3"><div className="font-medium">{title}</div><div className="mb-2 mt-0.5 text-xs text-muted-foreground">{note}</div>{children}</div>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center bg-background text-sm text-muted-foreground">{children}</div>;
}
