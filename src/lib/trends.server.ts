import { parse } from 'node-html-parser';
import type { TrendItem, Trends } from './trends';

export function parseGitHubTrending(html: string): TrendItem[] {
  return parse(html).querySelectorAll('article.Box-row').flatMap((row) => {
    const link = row.querySelector('h2 a');
    const path = link?.getAttribute('href') ?? '';
    if (!/^\/[\w.-]+\/[\w.-]+$/.test(path)) return [];
    const title = path.slice(1);
    return [{ id: `github:${title}`, source: 'github' as const, title, url: `https://github.com${path}`, description: row.querySelector('p')?.text.trim() ?? '', metric: row.querySelector('.float-sm-right')?.text.trim().replace(/\s+/g,' ') ?? '' }];
  }).slice(0,20);
}
let cache: Trends | undefined;
let pending: Promise<Trends> | undefined;
async function read(url: string) {
  const r = await fetch(url, { headers: { Accept: '*/*', 'User-Agent': 'OxfordBot-Trends' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`资讯来源返回 ${r.status}`);
  return r;
}
export async function getTrends(force = false): Promise<Trends> {
  if (!force && cache && Date.now() - cache.fetchedAt < 300000) return cache;
  if (pending) return pending;
  pending = (async () => {
    const results = await Promise.allSettled([
      (async () => {
        const items = parseGitHubTrending(await (await read('https://github.com/trending?since=daily')).text());
        if (!items.length) throw new Error('GitHub 趋势榜暂时无法解析');
        return items;
      })(),
      (async () => {
        const ids = await (await read('https://hacker-news.firebaseio.com/v0/topstories.json')).json() as number[];
        if (!Array.isArray(ids)) throw new Error('科技头条格式异常');
        const stories = await Promise.allSettled(ids.slice(0,15).filter(Number.isSafeInteger).map(async id => {
          const s = await (await read(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)).json() as { id:number; title?:string; url?:string; score?:number; descendants?:number; time?:number; deleted?:boolean };
          if (!s.title || s.deleted) return null;
          const fallback = `https://news.ycombinator.com/item?id=${id}`;
          let url = fallback;
          try { if (s.url && new URL(s.url).protocol === 'https:') url = s.url; } catch { /* Safe discussion link. */ }
          return { id:`hn:${id}`, source:'hn' as const, title:s.title, url, description:'', metric:`${s.score ?? 0} 分 · ${s.descendants ?? 0} 条讨论`, ...(s.time ? { publishedAt:s.time * 1000 } : {}) };
        }));
        return stories.flatMap(r => r.status === 'fulfilled' && r.value ? [r.value] : []);
      })(),
    ]);
    const items = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    const errors = results.flatMap((r,i) => r.status === 'rejected' ? [`${i===0?'GitHub Trending':'Hacker News'}：${r.reason instanceof Error ? r.reason.message : '暂时无法读取'}`] : []);
    cache = { items, fetchedAt:Date.now(), errors };
    return cache;
  })();
  try { return await pending; } finally { pending = undefined; }
}