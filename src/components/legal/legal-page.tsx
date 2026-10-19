import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const LEGAL_CONTACT = "info@oxfordintelligence.co.uk";
export const LEGAL_UPDATED = "2026-10-19";

export const LEGAL_COMPANY = {
  name: "OXFORD INTELLIGENCE LIMITED",
  number: "16299065",
  address:
    "Oxford Centre For Innovation Blue Boar Court, 9 Alfred Street, Oxford, England, OX1 4EH",
  email: LEGAL_CONTACT,
} as const;

export const LEGAL_ENTITY = `${LEGAL_COMPANY.name}（英格兰注册公司，公司注册号 ${LEGAL_COMPANY.number}，注册办公地址：${LEGAL_COMPANY.address}）`;

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background px-6 py-12">
      <article className="mx-auto max-w-2xl space-y-5 text-sm leading-7 text-muted-foreground [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground">
        <Link to="/" className="font-mono text-xs hover:text-foreground">← Oxford Bot</Link>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="font-mono text-xs">最后更新：{LEGAL_UPDATED}</p>
        {children}
        <p>如有疑问，请联系 <a className="text-foreground underline" href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>。</p>
        <LegalCompany />
        <LegalLinks />
      </article>
    </div>
  );
}

export function LegalCompany() {
  const rows: [string, ReactNode][] = [
    ["公司实体", LEGAL_COMPANY.name],
    ["公司注册号（Company Number）", LEGAL_COMPANY.number],
    ["注册办公地址（Registered Office Address）", LEGAL_COMPANY.address],
    [
      "官方联系邮箱",
      <a className="text-foreground underline" href={`mailto:${LEGAL_COMPANY.email}`}>
        {LEGAL_COMPANY.email}
      </a>,
    ],
  ];
  return (
    <section className="mt-10 border-t border-border pt-6">
      <h2 className="mt-0 text-base font-semibold text-foreground">公司实体信息</h2>
      <dl className="mt-3 space-y-2 rounded-lg border border-border bg-muted/30 p-4 text-xs leading-6">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
            <dt className="font-mono text-muted-foreground">{label}</dt>
            <dd className="text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
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
