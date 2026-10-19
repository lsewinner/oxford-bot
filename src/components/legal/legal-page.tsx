import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const LEGAL_CONTACT = "support@oxford.bot";
export const LEGAL_UPDATED = "2026-10-19";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background px-6 py-12">
      <article className="mx-auto max-w-2xl space-y-5 text-sm leading-7 text-muted-foreground [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground">
        <Link to="/" className="font-mono text-xs hover:text-foreground">← Oxford Bot</Link>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="font-mono text-xs">最后更新：{LEGAL_UPDATED}</p>
        {children}
        <p>如有疑问，请联系 <a className="text-foreground underline" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>。</p>
        <LegalLinks />
      </article>
    </div>
  );
}

export function LegalLinks({ onNavigate }: { onNavigate?: () => void }) {
  const cls = "hover:text-foreground underline-offset-4 hover:underline";
  return (
    <nav className="flex flex-wrap justify-center gap-4 pt-2 text-xs text-muted-foreground">
      <Link to="/terms" className={cls} onClick={onNavigate}>服务条款</Link>
      <Link to="/privacy" className={cls} onClick={onNavigate}>隐私政策</Link>
      <Link to="/refund" className={cls} onClick={onNavigate}>退款政策</Link>
    </nav>
  );
}
