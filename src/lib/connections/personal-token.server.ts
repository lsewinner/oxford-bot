import type { ProviderId } from './catalog';

export type PersonalTokenProvider = 'github' | 'slack' | 'cloudflare';
export function supportsPersonalToken(id: ProviderId): id is PersonalTokenProvider { return id === 'github' || id === 'slack' || id === 'cloudflare'; }
const HOSTS = { github: 'https://api.github.com', slack: 'https://slack.com', cloudflare: 'https://api.cloudflare.com/client/v4' } as const;
const NAMES = { github: 'GitHub', slack: 'Slack', cloudflare: 'Cloudflare' } as const;
const VALIDATE = { github: '/user', slack: '/api/auth.test', cloudflare: '/zones?per_page=1' } as const;
export async function callWithPersonalToken(id: PersonalTokenProvider, token: string, path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const allowed = id === 'github'
    ? /^\/(?:user(?:\?|$)|user\/repos(?:\?|$)|repos\/[^/]+\/[^/]+\/(?:issues|pulls|contents)(?:\/|\?|$))/
    : id === 'slack'
      ? /^\/api\/(?:auth\.test|conversations\.list|conversations\.history|users\.info|chat\.postMessage)(?:\?|$)/
      // Cloudflare is read-only for now: zone list and DNS record list only.
      : (method === 'GET' ? /^\/zones(?:\?|$|\/[a-f0-9]{32}\/dns_records(?:\?|$))/ : /$^/);
  if (!allowed.test(path) || path.includes('://') || path.includes('..') || path.includes('\\')) throw new Error('不支持的服务请求');
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (id === 'github') { headers.set('Accept', 'application/vnd.github+json'); headers.set('X-GitHub-Api-Version', '2022-11-28'); headers.set('User-Agent', 'Oxford-Bot'); }
  const res = await fetch(`${HOSTS[id]}${path}`, { ...init, headers, redirect: 'manual' });
  // Never follow redirects off the fixed provider host; surface them as a gateway error.
  if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) return new Response(JSON.stringify({ error: 'unexpected_redirect' }), { status: 502, headers: { 'content-type': 'application/json' } });
  return res;
}
export function personalTokenError(id: PersonalTokenProvider, status: number, slackError?: unknown) {
  const name = NAMES[id];
  if (status === 401 || (id === 'cloudflare' && status === 400) || ['invalid_auth','token_revoked','token_expired','not_authed','account_inactive'].includes(String(slackError))) return `${name} Token 已失效，请重新输入`;
  if (status === 403 || slackError === 'missing_scope' || slackError === 'no_permission') return `${name} Token 权限不足，请检查所需权限`;
  if (status === 429 || slackError === 'ratelimited') return `${name} 请求过于频繁，请稍后再试`;
  if (slackError === 'not_in_channel') return '请先将此 Slack 账户或 Bot 加入目标频道';
  if (slackError === 'channel_not_found') return 'Slack 频道不存在或当前 Token 无权访问';
  return `${name} 请求失败（${status}），请检查服务状态与 Token 权限`;
}
export async function validatePersonalToken(id: PersonalTokenProvider, token: string) {
  let response: Response;
  try { response = await callWithPersonalToken(id, token, VALIDATE[id]); }
  catch { throw new Error('无法访问服务，请稍后重试'); }
  if (!response.ok) throw new Error(personalTokenError(id, response.status));
  const body = await response.json().catch(() => null);
  if (!body || (id === 'github' ? !body.id : id === 'cloudflare' ? body.success !== true : body.ok !== true)) throw new Error(personalTokenError(id, response.status, body?.error));
}