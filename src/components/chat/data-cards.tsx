import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--primary)"];
const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 } };

type Quote = { symbol: string; error?: string; name?: string; currency?: string; exchange?: string; price?: number; rangeChangePercent?: number | null; high52w?: number | null; low52w?: number | null; time?: string; series?: { t: number; close: number }[] };
export type MarketOutput = { range?: string; quotes?: Quote[]; source?: string };

export function MarketQuotes({ output }: { output: MarketOutput }) {
  const fmt = (v: number | null | undefined) => (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : "-");
  return (
    <div className="my-3 grid gap-3 sm:grid-cols-2">
      {(output.quotes ?? []).map((q) => {
        if (q.error) return <div key={q.symbol} className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">{q.symbol} · {q.error}</div>;
        const up = (q.rangeChangePercent ?? 0) >= 0;
        const color = up ? "var(--chart-2)" : "var(--destructive)";
        return (
          <div key={q.symbol} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{q.name}</p><p className="font-mono text-xs text-muted-foreground">{q.symbol} · {q.exchange}</p></div>
              <div className="text-right"><p className="font-mono text-base">{fmt(q.price)} <span className="text-xs text-muted-foreground">{q.currency}</span></p><p className="font-mono text-xs" style={{ color }}>{up ? "+" : ""}{q.rangeChangePercent ?? "-"}% · {output.range}</p></div>
            </div>
            {q.series && q.series.length > 1 && (
              <div className="mt-2 h-24"><ResponsiveContainer width="100%" height="100%"><AreaChart data={q.series}><defs><linearGradient id={`g-${q.symbol}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs><YAxis hide domain={["auto", "auto"]} /><Tooltip {...tip} labelFormatter={(t) => new Date(Number(t)).toLocaleString()} formatter={(v) => [fmt(Number(v)), "收盘"]} /><XAxis dataKey="t" hide /><Area dataKey="close" stroke={color} fill={`url(#g-${q.symbol})`} strokeWidth={1.5} dot={false} /></AreaChart></ResponsiveContainer></div>
            )}
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">52 周 {fmt(q.low52w)} – {fmt(q.high52w)}</p>
          </div>
        );
      })}
      {output.source && <p className="text-[11px] text-muted-foreground sm:col-span-2">数据来源：{output.source}</p>}
    </div>
  );
}

export type ChartOutput = { type: "bar" | "line" | "area" | "pie"; title: string; xKey: string; series: { key: string; label?: string }[]; data: Record<string, string | number | null>[] };

export function DataChart({ spec }: { spec: ChartOutput }) {
  const series = spec.series.map((s, i) => ({ ...s, name: s.label ?? s.key, color: COLORS[i % COLORS.length] }));
  const common = <><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey={spec.xKey} {...axis} /><YAxis {...axis} width={48} /><Tooltip {...tip} />{series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}</>;
  return (
    <figure className="my-3 rounded-xl border border-border bg-card p-3">
      <figcaption className="mb-2 text-sm font-medium">{spec.title}</figcaption>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === "pie" ? (
            <PieChart><Tooltip {...tip} /><Legend wrapperStyle={{ fontSize: 12 }} /><Pie data={spec.data} dataKey={series[0]!.key} nameKey={spec.xKey} innerRadius="45%" outerRadius="80%" stroke="var(--card)">{spec.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie></PieChart>
          ) : spec.type === "bar" ? (
            <BarChart data={spec.data}>{common}{series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} />)}</BarChart>
          ) : spec.type === "area" ? (
            <AreaChart data={spec.data}>{common}{series.map((s) => <Area key={s.key} dataKey={s.key} name={s.name} stroke={s.color} fill={s.color} fillOpacity={0.15} />)}</AreaChart>
          ) : (
            <LineChart data={spec.data}>{common}{series.map((s) => <Line key={s.key} dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} />)}</LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
