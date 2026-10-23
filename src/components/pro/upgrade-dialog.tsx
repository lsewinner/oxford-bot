import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckIcon, MinusIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEATURE_PROMPTS, PLAN_ROWS, PLAN_PRICES, subscriptionActive, type PaidPlan, type BillingCycle, type ProFeature } from "@/lib/pro";
import { getStripe, getStripeEnvironment, paymentsConfigured } from "@/lib/stripe";
import { createCheckoutSession, createPortalSession } from "@/lib/payments.functions";
import { usePro } from "./pro-context";
import { LegalLinks } from "@/components/legal/legal-page";

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <CheckIcon className="mx-auto size-4 text-foreground" aria-label="包含" />;
  if (value === false) return <MinusIcon className="mx-auto size-4 text-muted-foreground" aria-label="不包含" />;
  return <span className="text-xs">{value}</span>;
}

export function PaymentTestModeBanner() {
  const token = import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN'] as string | undefined;
  if (!token) return <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">正式付款尚未开通，请先完成 Stripe 上线设置。</div>;
  if (token.startsWith("pk_test_")) return <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">预览中的付款均为测试模式，可用卡号 4242 4242 4242 4242。<a className="underline" href="https://docs.lovable.dev/features/payments#test-and-live-environments" target="_blank" rel="noopener noreferrer">了解更多</a></div>;
  return null;
}

function Checkout({ cycle, plan }: { cycle: BillingCycle; plan: PaidPlan }) {
  const fetchClientSecret = async () => {
    const result = await createCheckoutSession({ data: { priceId: PLAN_PRICES[plan][cycle].priceId, returnUrl: `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`, environment: getStripeEnvironment() } });
    if ("error" in result) throw new Error(result.error);
    return result.clientSecret;
  };
  return <div className="overflow-hidden rounded-lg bg-background"><EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}><EmbeddedCheckout /></EmbeddedCheckoutProvider></div>;
}

export function UpgradeDialog({ feature, onClose }: { feature: ProFeature | null; onClose: () => void }) {
  const { isPro, plan: currentPlan, userId, subscription, loading } = usePro();
  const [plan, setPlan] = useState<PaidPlan>("pro");
  const paidActive = subscriptionActive(subscription);
  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const prices = PLAN_PRICES[plan][cycle];
  const [checkout, setCheckout] = useState(false);
  const [portalBusy, setPortalBusy] = useState(false);
  const lapsed = !isPro && subscription !== null;
  const openPortal = async () => {
    setPortalBusy(true);
    try {
      const result = await createPortalSession({ data: { returnUrl: window.location.href, environment: getStripeEnvironment() } });
      if ("error" in result) throw new Error(result.error);
      window.open(result.url, "_blank");
    } catch (e) { toast.error(e instanceof Error ? e.message : "无法打开订阅管理"); }
    finally { setPortalBusy(false); }
  };
  return <Dialog open={feature !== null} onOpenChange={(v) => { if (!v) { setCheckout(false); onClose(); } }}>
    <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><SparklesIcon className="size-5" />{isPro ? `你已是 Oxford ${currentPlan === "ultra" ? "Ultra" : "Pro"}` : "升级 Oxford 会员"}</DialogTitle>
        <DialogDescription>{isPro ? "全部 Pro 权益已解锁，Ultra 每天可发送 800 条消息。" : lapsed ? "你的 Pro 订阅已结束，已有 Bot 数据仍保留，重新订阅即可解锁。" : FEATURE_PROMPTS[feature ?? "general"]}</DialogDescription>
      </DialogHeader>
      <PaymentTestModeBanner />
      {checkout && !paidActive ? <div className="space-y-3"><Checkout key={`${plan}-${cycle}`} cycle={cycle} plan={plan} /><Button variant="ghost" size="sm" onClick={() => setCheckout(false)}>返回方案对比</Button></div> : <>
        <div role="radiogroup" aria-label="付费周期" className="mx-auto flex w-fit rounded-full border border-border p-1">
          {(["monthly", "yearly"] as const).map((c) => <Button variant="ghost" key={c} type="button" role="radio" aria-checked={cycle === c} onClick={() => setCycle(c)} className={cn("rounded-full px-4 py-1.5 text-sm transition-colors", cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{c === "monthly" ? "月付" : "年付 · 省 20%"}</Button>)}
        </div>
        <div role="radiogroup" aria-label="会员方案" className="flex justify-center gap-2">
          {(["pro", "ultra"] as const).map((p) => <Button key={p} role="radio" aria-checked={plan === p} variant={plan === p ? "default" : "outline"} onClick={() => setPlan(p)}>{p === "pro" ? "Pro" : "Ultra"}</Button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4"><p className="text-sm font-medium">Free</p><p className="mt-2 text-3xl font-semibold">$0</p><p className="text-xs text-muted-foreground">永久免费 · 30 条/天</p></div>
          {(["pro", "ultra"] as const).map((p) => <div key={p} className={cn("rounded-lg border p-4", plan === p ? "border-primary" : "border-border")}><p className="text-sm font-medium">{p === "pro" ? "Pro" : "Ultra"}</p><p className="mt-2 text-3xl font-semibold">{PLAN_PRICES[p][cycle].label}</p><p className="text-xs text-muted-foreground">{PLAN_PRICES[p][cycle].note}</p></div>)}
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="py-2 text-left font-normal">权益</th><th className="min-w-16 font-normal">Free</th><th className="min-w-16 font-normal">Pro</th><th className="min-w-16 font-normal">Ultra</th></tr></thead>
          <tbody>{PLAN_ROWS.map((r) => <tr key={r.label} className="border-t border-border"><td className="py-2.5 pr-2">{r.label}</td><td className="text-center"><Cell value={r.free} /></td><td className="text-center"><Cell value={r.pro} /></td><td className="text-center"><Cell value={r.ultra} /></td></tr>)}</tbody></table></div>
        {paidActive ? <Button className="w-full" disabled={portalBusy} onClick={openPortal}>{portalBusy ? "正在打开…" : "管理或变更订阅"}</Button>
          : userId ? <Button className="w-full whitespace-normal" size="lg" disabled={loading || !paymentsConfigured()} onClick={() => setCheckout(true)}>订阅 {plan === "ultra" ? "Ultra" : "Pro"} · {prices.label}{prices.note.split(" · ")[0]}</Button>
          : <Button asChild className="w-full" size="lg"><Link to="/auth" onClick={onClose}>登录后升级会员</Link></Button>}
        {!paidActive && subscription && <Button variant="outline" disabled={portalBusy} onClick={openPortal}>管理历史订阅</Button>}
        {subscription?.cancel_at_period_end && isPro && subscription.current_period_end && <p className="text-center text-xs text-muted-foreground">订阅将于 {new Date(subscription.current_period_end).toLocaleDateString("zh-CN")} 结束</p>}
        <p className="text-center text-xs text-muted-foreground">订阅即表示同意以下条款，自动续费，可随时取消。</p>
        <LegalLinks onNavigate={onClose} />
      </>}
    </DialogContent>
  </Dialog>;
}

export function UpgradeEntry() {
  const { isPro, plan, openUpgrade } = usePro();
  return <Button variant="ghost" type="button" onClick={() => openUpgrade("general")} aria-label={isPro ? "Pro 会员" : "Upgrade to Pro 升级会员"}
    className="mx-3 mb-2 flex h-auto justify-start items-center gap-2.5 rounded-lg border border-sidebar-border px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent">
    <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground"><SparklesIcon className="size-3.5" /></span>
    <span className="min-w-0"><span className="block text-sm font-medium">{isPro ? `Oxford ${plan === "ultra" ? "Ultra" : "Pro"}` : "Upgrade to Pro / Ultra"}</span><span className="block text-[11px] text-muted-foreground">{isPro ? "全部权益已解锁 · 管理订阅" : "升级会员 · 解锁全部猫咪与工具"}</span></span>
  </Button>;
}

export function ProBadge() {
  const { isPro, plan } = usePro();
  if (!isPro) return null;
  return <span className="rounded-full border border-primary/60 px-1.5 py-px text-[10px] font-semibold tracking-wide">{plan === "ultra" ? "ULTRA" : "PRO"}</span>;
}
