import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftIcon, LoaderCircleIcon, RefreshCwIcon, SendIcon, SunriseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BRIEFING_SOURCES, BRIEFING_SOURCE_LABELS, type BriefingSource } from "@/lib/briefing";
import { getBriefing, saveBriefing, sendBriefingNow, telegramChats } from "@/lib/briefing.functions";

export const Route = createFileRoute("/_authenticated/briefing")({
  head: () => ({
    meta: [
      { title: "主动早报 · Oxford Bot" },
      { name: "description", content: "每天定时把日程、待办与科技热点整理成早报，推送到你的 Telegram。" },
      { property: "og:title", content: "主动早报 · Oxford Bot" },
      { property: "og:description", content: "Oxford Bot 每天主动为你整理日程、待办和热点。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BriefingPage,
});

const selectCls = "h-9 rounded-md border border-border bg-background px-2 text-sm";

function BriefingPage() {
  const fetchIt = useServerFn(getBriefing);
  const save = useServerFn(saveBriefing);
  const sendNow = useServerFn(sendBriefingNow);
  const listChats = useServerFn(telegramChats);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["briefing"], queryFn: () => fetchIt() });
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(9);
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [sources, setSources] = useState<BriefingSource[]>(["trends", "calendar", "jira"]);
  const [account, setAccount] = useState("");
  const [chatId, setChatId] = useState("");
  const [chats, setChats] = useState<{ id: string; title: string }[]>([]);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    const s = data?.settings;
    if (s) {
      setEnabled(s.enabled); setHour(s.hour); setTimezone(s.timezone);
      setSources(s.sources.filter((x): x is BriefingSource => (BRIEFING_SOURCES as readonly string[]).includes(x)));
      setAccount(s.telegram_account); setChatId(s.telegram_chat_id);
      if (s.telegram_chat_id) setChats([{ id: s.telegram_chat_id, title: `已保存 · ${s.telegram_chat_id}` }]);
    } else {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai");
      if (data?.telegramAccounts[0]) setAccount(data.telegramAccounts[0].key);
    }
  }, [data]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "操作失败"); } finally { setBusy(""); }
  }
  const persist = () => save({ data: { enabled, hour, timezone, sources, telegramAccount: account, telegramChatId: chatId } });
  const s = data?.settings;
  const noTelegram = data && data.telegramAccounts.length === 0;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/chat" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" />返回对话</Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold"><SunriseIcon className="size-6" />主动早报</h1>
            <p className="mt-2 text-sm text-muted-foreground">每天到点，Oxford 主动读取你的日程、Jira 待办和科技热点，整理成一份早报推送到 Telegram。只读取，不会替你修改任何内容。</p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">启用<Switch checked={enabled} onCheckedChange={setEnabled} aria-label="启用主动早报" /></label>
        </div>

        {isLoading ? <LoaderCircleIcon className="mt-10 animate-spin text-muted-foreground" /> : (
          <>
            <section className="mt-8 space-y-4 rounded-lg border border-border p-5">
              <p className="text-sm font-medium">推送时间</p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                每天
                <select className={selectCls} value={hour} onChange={(e) => setHour(Number(e.target.value))} aria-label="推送小时">
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
                <span className="font-mono text-xs text-muted-foreground">{timezone}</span>
              </div>
              <p className="text-xs text-muted-foreground">会在整点后约 1 分钟内送达。</p>
            </section>

            <section className="mt-4 space-y-3 rounded-lg border border-border p-5">
              <p className="text-sm font-medium">早报内容</p>
              <div className="flex flex-wrap gap-2">
                {BRIEFING_SOURCES.map((src) => {
                  const on = sources.includes(src);
                  return <Button key={src} size="sm" variant={on ? "default" : "outline"} onClick={() => setSources(on ? sources.filter((x) => x !== src) : [...sources, src])}>{BRIEFING_SOURCE_LABELS[src]}</Button>;
                })}
              </div>
              <p className="text-xs text-muted-foreground">日程来自已连接的 Google / Outlook 日历，待办来自已连接的 Jira；未连接的来源会自动跳过。</p>
            </section>

            <section className="mt-4 space-y-3 rounded-lg border border-border p-5">
              <p className="text-sm font-medium">推送到 Telegram</p>
              {noTelegram ? (
                <p className="text-sm text-muted-foreground">还没有连接 Telegram。请先回到对话，在「工具与连接」中连接你的 Telegram Bot，并给它发一条消息。</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <select className={selectCls} value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Telegram Bot">
                      {data?.telegramAccounts.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                    </select>
                    <Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => run("chats", async () => {
                      const r = await listChats({ data: { account } });
                      setChats(r.chats);
                      if (r.chats[0] && !chatId) setChatId(r.chats[0].id);
                      if (r.note) toast.message(r.note);
                    })}>{busy === "chats" ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}读取聊天</Button>
                  </div>
                  {chats.length > 0 && (
                    <select className={`${selectCls} w-full`} value={chatId} onChange={(e) => setChatId(e.target.value)} aria-label="接收聊天">
                      {chats.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  )}
                  <p className="text-xs text-muted-foreground">先在 Telegram 里给你的 Bot 发一句话，再点「读取聊天」选择接收早报的对话。</p>
                </>
              )}
            </section>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button disabled={Boolean(busy) || sources.length === 0} onClick={() => run("save", async () => { await persist(); await qc.invalidateQueries({ queryKey: ["briefing"] }); toast.success(enabled ? `已开启，每天 ${String(hour).padStart(2, "0")}:00 推送` : "已保存"); })}>
                {busy === "save" && <LoaderCircleIcon className="animate-spin" />}保存设置
              </Button>
              <Button variant="outline" disabled={Boolean(busy) || !chatId || sources.length === 0} onClick={() => run("send", async () => { await persist(); await sendNow(); await qc.invalidateQueries({ queryKey: ["briefing"] }); toast.success("早报已发送到 Telegram"); })}>
                {busy === "send" ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />}{busy === "send" ? "正在整理早报…" : "立即发送一份试试"}
              </Button>
            </div>
            {s?.last_run_at && (
              <p className={`mt-4 text-xs ${s.last_status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                上次推送：{new Date(s.last_run_at).toLocaleString("zh-CN")} · {s.last_status === "error" ? `失败：${s.last_error}` : "已送达"}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
