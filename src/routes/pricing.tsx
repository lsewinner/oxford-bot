import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckIcon, MinusIcon } from "lucide-react";
import { PLAN_ROWS, PLAN_PRICES } from "@/lib/pro";
import { Button } from "@/components/ui/button";
import { usePro } from "@/components/pro/pro-context";
import { LegalLinks } from "@/components/legal/legal-page";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "价格与权益 · Oxford Bot" },
      { name: "description", content: "Oxford Bot Free 与 Pro 权益对比：Pro 月付 $25、年付 $240；Ultra 月付 $60、年付 $576，每天 800 条。" },
      { property: "og:title", content: "价格与权益 · Oxford Bot" },
      { property: "og:description", content: "Free、Pro 与 Ultra 权益与每日额度对比，月付或年付。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pricing,
});

const Cell = ({ v }: { v: string | boolean }) =>
  v === true ? <CheckIcon className="mx-auto size-4" aria-label="包含" /> : v === false ? <MinusIcon className="mx-auto size-4 text-muted-foreground" aria-label="不包含" /> : <span className="text-xs">{v}</span>;

function Pricing() {
  const { userId, openUpgrade } = usePro();
  return (
    <div className="min-h-dvh bg-background bg-glow px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回首页</Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">价格与权益</h1>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4"><p className="text-sm font-medium">Free</p><p className="mt-2 text-2xl font-semibold">$0</p><p className="text-xs text-muted-foreground">永久免费</p></div>
          {(["pro", "ultra"] as const).map((p) => <div key={p} className="rounded-lg border border-primary p-4"><p className="text-sm font-medium">{p === "pro" ? "Pro" : "Ultra"}</p><p className="mt-2 text-2xl font-semibold">{PLAN_PRICES[p].monthly.label}<span className="text-xs text-muted-foreground"> / 月</span></p><p className="mt-2 text-sm">{PLAN_PRICES[p].yearly.label} / 年</p><p className="text-xs text-muted-foreground">{PLAN_PRICES[p].yearly.note}</p></div>)}
        </div>
        <div className="overflow-x-auto"><table className="mt-8 w-full text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="py-2 text-left font-normal">权益</th><th className="min-w-16 font-normal">Free</th><th className="min-w-16 font-normal">Pro</th><th className="min-w-16 font-normal">Ultra</th></tr></thead>
          <tbody>{PLAN_ROWS.map((r) => <tr key={r.label} className="border-t border-border"><td className="py-2.5 pr-2">{r.label}</td><td className="text-center"><Cell v={r.free} /></td><td className="text-center"><Cell v={r.pro} /></td><td className="text-center"><Cell v={r.ultra} /></td></tr>)}</tbody></table></div>
        {userId ? <Button className="mt-8" onClick={() => openUpgrade("general")}>选择或管理会员方案</Button> : <Button asChild className="mt-8"><Link to="/auth">登录后升级会员</Link></Button>}
        <div className="mt-10"><LegalLinks /></div>
      </div>
    </div>
  );
}
