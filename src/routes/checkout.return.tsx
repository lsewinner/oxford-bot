import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePro } from "@/components/pro/pro-context";
import { paidPlanForPrice, subscriptionActive } from "@/lib/pro";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string | undefined; plan?: "pro" | "ultra" | undefined } => ({ session_id: typeof s["session_id"] === "string" ? s["session_id"] : undefined, plan: s["plan"] === "ultra" ? "ultra" : s["plan"] === "pro" ? "pro" : undefined }),
  head: () => ({ meta: [
    { title: "Oxford Bot · 升级完成" },
    { name: "description", content: "Oxford Pro 与 Ultra 订阅结果。" },
    { property: "og:title", content: "Oxford Bot · 升级完成" },
    { property: "og:description", content: "Oxford Pro 与 Ultra 订阅结果。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id, plan: expectedPlan } = Route.useSearch();
  const { userId, subscription } = usePro();
  const plan = paidPlanForPrice(subscription?.price_id);
  const isPro = subscriptionActive(subscription) && (!expectedPlan || plan === expectedPlan);
  const qc = useQueryClient();
  useEffect(() => {
    if (isPro || !userId) return;
    const t = setInterval(() => void qc.invalidateQueries({ queryKey: ["subscription", userId] }), 2000);
    return () => clearInterval(t);
  }, [isPro, userId, qc]);
  return <main className="flex min-h-dvh items-center justify-center bg-background p-6">
    <div className="max-w-sm space-y-4 text-center">
      <SparklesIcon className="mx-auto size-10" />
      <h1 className="text-2xl font-semibold">{!session_id ? "没有找到付款信息" : isPro ? `欢迎加入 Oxford ${plan === "ultra" ? "Ultra" : "Pro"}` : "付款已提交，正在开通…"}</h1>
      <p className="text-sm text-muted-foreground">{isPro ? "更多猫咪 Bot、自定义人设、Deep Think 与真实工具连接已全部解锁。" : "通常几秒内完成，本页会自动刷新状态。"}</p>
      <Button asChild><Link to="/chat">返回对话</Link></Button>
    </div>
  </main>;
}
