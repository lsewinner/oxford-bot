import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listBotSubmissions, reviewBotSubmission } from "@/lib/bot-shares.functions";
import { CATEGORY_LABEL, type SquareCategory } from "@/lib/bot-square";

const STATUS: Record<string, string> = { pending: "待审核", approved: "已上架", rejected: "已驳回" };

export function BotReview() {
  const list = useServerFn(listBotSubmissions);
  const review = useServerFn(reviewBotSubmission);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["bot-submissions"], queryFn: () => list() });
  const act = useMutation({
    mutationFn: (v: { token: string; approve: boolean }) => review({ data: v }),
    onSuccess: (_r, v) => { toast.success(v.approve ? "已批准上架" : "已驳回 / 下架"); void qc.invalidateQueries({ queryKey: ["bot-submissions"] }); void qc.invalidateQueries({ queryKey: ["square-bots"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "操作失败"),
  });
  if (q.isLoading) return <p className="mt-6 text-sm text-muted-foreground">加载中…</p>;
  if (q.error) return <p className="mt-6 text-sm text-destructive">读取失败，请刷新重试</p>;
  const rows = [...(q.data ?? [])].sort((a, b) => Number(b.submission_status === "pending") - Number(a.submission_status === "pending"));
  if (!rows.length) return <p className="mt-6 text-sm text-muted-foreground">暂无用户提交的 Bot。</p>;
  return <div className="mt-4 overflow-x-auto rounded-xl border border-border">
    <table className="w-full min-w-[760px] text-sm">
      <thead className="bg-card text-left text-xs text-muted-foreground"><tr><th className="p-3">Bot</th><th className="p-3">分类</th><th className="p-3">简介</th><th className="p-3">创作者</th><th className="p-3">提交时间</th><th className="p-3">状态</th><th className="p-3 text-right">操作</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.token} className="border-t border-border align-top">
        <td className="p-3 font-medium">{r.name}</td>
        <td className="p-3">{CATEGORY_LABEL[r.category as SquareCategory] ?? r.category}</td>
        <td className="max-w-xs p-3 text-muted-foreground">{r.intro || "—"}</td>
        <td className="p-3">{r.creator_name || "—"}</td>
        <td className="p-3 text-muted-foreground">{r.submitted_at ? new Date(r.submitted_at).toLocaleString("zh-CN", { hour12: false }) : "—"}</td>
        <td className="p-3">{STATUS[r.submission_status] ?? r.submission_status}</td>
        <td className="space-x-1 whitespace-nowrap p-3 text-right">
          <Button asChild size="sm" variant="ghost"><a href={`/b/${r.token}`} target="_blank" rel="noreferrer">试聊</a></Button>
          {r.submission_status !== "approved" && <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ token: r.token, approve: true })}>批准上架</Button>}
          {r.submission_status !== "rejected" && <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ token: r.token, approve: false })}>{r.submission_status === "approved" ? "下架" : "驳回"}</Button>}
        </td>
      </tr>)}</tbody>
    </table>
  </div>;
}
