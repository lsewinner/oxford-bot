import { z } from 'zod';

/** Public market data (no account): stocks, indices, ETFs, FX and crypto via Yahoo Finance chart API on a fixed host. */
export const marketInput = z.object({
  symbols: z.array(z.string().trim().regex(/^[\w.^=-]{1,20}$/)).min(1).max(8),
  range: z.enum(['1d', '5d', '1mo', '3mo', '6mo', '1y', '5y']).optional(),
}).strict();
export type MarketInput = z.infer<typeof marketInput>;

const INTERVAL: Record<string, string> = { '1d': '5m', '5d': '30m', '1mo': '1d', '3mo': '1d', '6mo': '1d', '1y': '1wk', '5y': '1mo' };

/** Normalise common shorthand: BTC → BTC-USD, 700.HK → 0700.HK, 600519.SH → 600519.SS. */
export function normaliseSymbol(raw: string) {
  const s = raw.trim().toUpperCase();
  if (/^(BTC|ETH|SOL|BNB|XRP|DOGE|ADA|TON|AVAX|LINK|DOT|LTC|TRX)$/.test(s)) return `${s}-USD`;
  const hk = /^(\d{1,5})\.HK$/.exec(s);
  if (hk) return `${hk[1]!.padStart(4, '0')}.HK`;
  return s.replace(/\.SH$/, '.SS');
}

export async function fetchQuotes(input: MarketInput) {
  const range = input.range ?? '1mo';
  const results = await Promise.all(input.symbols.map(async (raw) => {
    const symbol = normaliseSymbol(raw);
    try {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${INTERVAL[range]}`, { headers: { 'User-Agent': 'Mozilla/5.0 (Oxford Bot)' }, redirect: 'manual' });
      if (!res.ok) return { symbol, error: res.status === 404 ? '未找到该代码' : `行情源暂时不可用（${res.status}）` };
      const body = await res.json() as { chart?: { result?: Array<{ meta: Record<string, unknown>; timestamp?: number[]; indicators?: { quote?: Array<{ close?: (number | null)[] }> } }> } };
      const r = body.chart?.result?.[0];
      if (!r) return { symbol, error: '未找到该代码' };
      const m = r.meta;
      const closes = r.indicators?.quote?.[0]?.close ?? [];
      const series = (r.timestamp ?? []).map((t, i) => ({ t: t * 1000, close: closes[i] })).filter((p): p is { t: number; close: number } => typeof p.close === 'number');
      const step = Math.max(1, Math.ceil(series.length / 60));
      const price = Number(m['regularMarketPrice']);
      const prev = Number(m['chartPreviousClose'] ?? m['previousClose']);
      return {
        symbol, name: String(m['longName'] ?? m['shortName'] ?? symbol), currency: String(m['currency'] ?? ''), exchange: String(m['fullExchangeName'] ?? ''),
        type: String(m['instrumentType'] ?? ''), price, rangeChangePercent: prev ? Number((((price - prev) / prev) * 100).toFixed(2)) : null,
        dayHigh: m['regularMarketDayHigh'] ?? null, dayLow: m['regularMarketDayLow'] ?? null, high52w: m['fiftyTwoWeekHigh'] ?? null, low52w: m['fiftyTwoWeekLow'] ?? null,
        volume: m['regularMarketVolume'] ?? null, time: new Date(Number(m['regularMarketTime']) * 1000).toISOString(),
        series: series.filter((_, i) => i % step === 0 || i === series.length - 1).map((p) => ({ t: p.t, close: Number(p.close.toFixed(4)) })),
      };
    } catch { return { symbol, error: '行情源连接失败，请稍后再试' }; }
  }));
  return { range, quotes: results, source: 'Yahoo Finance（可能有延迟，仅供参考，不构成投资建议）' };
}

/** Chart specs the model produces from attachment / sheet data; rendered client-side. */
export const chartInput = z.object({
  type: z.enum(['bar', 'line', 'area', 'pie']),
  title: z.string().max(120),
  xKey: z.string().max(60),
  series: z.array(z.object({ key: z.string().max(60), label: z.string().max(60).optional() })).min(1).max(6),
  data: z.array(z.record(z.string(), z.union([z.string().max(120), z.number(), z.null()]))).min(1).max(200),
}).strict();
export type ChartSpec = z.infer<typeof chartInput>;
