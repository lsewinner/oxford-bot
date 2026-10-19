import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckIcon, MinusIcon } from "lucide-react";
import { PLAN_ROWS, PRO_PRICES } from "@/lib/pro";
import { LegalLinks } from "@/components/legal/legal-page";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "价格与权益 · Oxford Bot" },
      { name: "description", content: "Oxford Bot Free 与 Pro 权益对比：Pro 月付 $25，年付 $240。" },
      { property: "og:title", content: "价格与权益 · Oxford Bot" },
      { property: "og:description", content: "Free 与 Pro 权益对比，月付或年付。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Pricing,
});

const Cell = ({ v }: { v: string | boolean }) =>
  v === true ? <CheckIcon className="mx-auto size-4" aria-label="包含" /> : v === false ? <MinusIcon className="mx-auto size-4 text-muted-foreground" aria-label="不包含" /> : <span className="text-xs">{v}</span>;

function Pricing() {
  return (
    <div className="min-h-dvh bg-background bg-glow px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回首页</Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">价格与权益</h1>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border p-4"><p className="text-sm font-medium">Free</p><p className="mt-2 text-2xl font-semibold">$0</p><p className="text-xs text-muted-foreground">永久免费</p></div>
          <div className="rounded-xl border border-primary p-4"><p className="text-sm font-medium">Pro 月付</p><p className="mt-2 text-2xl font-semibold">{PRO_PRICES.monthly.label}</p><p className="text-xs text-muted-foreground">{PRO_PRICES.monthly.note}</p></div>
          <div className="rounded-xl border border-primary p-4"><p className="text-sm font-medium">Pro 年付</p><p className="mt-2 text-2xl font-semibold">{PRO_PRICES.yearly.label}</p><p className="text-xs text-muted-foreground">{PRO_PRICES.yearly.note}</p></div>
        </div>
        <table className="mt-8 w-full text-sm"><thead><tr className="text-xs text-muted-foreground"><th className="py-2 text-left font-normal">权益</th><th className="w-24 font-normal">Free</th><th className="w-24 font-normal">Pro</th></tr></thead>
          <tbody>{PLAN_ROWS.map((r) => <tr key={r.label} className="border-t border-border"><td className="py-2.5 pr-2">{r.label}</td><td className="text-center"><Cell v={r.free} /></td><td className="text-center"><Cell v={r.pro} /></td></tr>)}</tbody></table>
        <Link to="/auth" className="mt-8 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground">登录后升级 Pro</Link>
        <div className="mt-10"><LegalLinks /></div>
      </div>
    </div>
  );
}
