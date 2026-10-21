import type { ProviderId } from './catalog';

export type PersonalTokenProvider = 'github' | 'slack' | 'cloudflare' | 'supabase' | 'notion' | 'yuque' | 'feishu' | 'gitee' | 'flomo';
export function supportsPersonalToken(id: ProviderId): id is PersonalTokenProvider { return id === 'github' || id === 'slack' || id === 'cloudflare' || id === 'supabase' || id === 'notion' || id === 'yuque' || id === 'feishu' || id === 'gitee' || id === 'flomo'; }
const HOSTS = { github: 'https://api.github.com', slack: 'https://slack.com', cloudflare: 'https://api.cloudflare.com/client/v4', supabase: 'https://api.supabase.com/v1', notion: 'https://api.notion.com/v1', yuque: 'https://www.yuque.com/api/v2', feishu: 'https://open.feishu.cn/open-apis', gitee: 'https://gitee.com/api/v5', flomo: 'https://flomoapp.com' } as const;
const NAMES = { github: 'GitHub', slack: 'Slack', cloudflare: 'Cloudflare', supabase: 'Supabase', notion: 'Notion', yuque: '语雀', feishu: '飞书', gitee: 'Gitee', flomo: 'Flomo' } as const;
const VALIDATE = { github: '/user', slack: '/api/auth.test', cloudflare: '/zones?per_page=1', supabase: '/projects', notion: '/users/me', yuque: '/user', feishu: '/bot/v3/info', gitee: '/user', flomo: '' } as const;
export async function callWithPersonalToken(id: PersonalTokenProvider, token: string, path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (id === 'flomo') {
    // Flomo credentials are the user's private incoming-webhook URL; only that exact URL may receive a POST.
    const url = parseFlomoWebhook(token);
    if (method !== 'POST' || path !== '') throw new Error('不支持的服务请求');
    return fetch(url, { ...init, redirect: 'manual' });
  }
  const allowed = id === 'feishu'
    // Feishu: wiki/docx/bitable reads plus confirmed bitable record creation only.
    ? (method === 'GET' ? /^\/(?:bot\/v3\/info|wiki\/v2\/spaces\?page_size=\d+|wiki\/v2\/spaces\/\w+\/nodes\?page_size=\d+(?:&parent_node_token=\w+)?|docx\/v1\/documents\/\w+\/raw_content|bitable\/v1\/apps\/\w+\/tables\?page_size=\d+|bitable\/v1\/apps\/\w+\/tables\/\w+\/records\?page_size=\d+)$/
      : method === 'POST' ? /^\/bitable\/v1\/apps\/\w+\/tables\/\w+\/records$/ : /$^/)
    : id === 'gitee'
    // Gitee: user, repos, issues, file contents; confirmed issue creation only.
    ? (method === 'GET' ? /^\/(?:user|user\/repos\?per_page=\d+&sort=updated|repos\/[\w.-]+\/[\w.-]+\/(?:issues\?state=open&per_page=\d+|contents\/[^?#]+))$/
      : method === 'POST' ? /^\/repos\/[\w.-]+\/issues$/ : /$^/)
    : id === 'yuque'
    ? (method === 'GET' ? /^\/(?:user|users\/[\w-]+\/repos\?offset=\d+&limit=\d+|repos\/[\w-]+\/[\w-]+\/docs(?:\?offset=\d+&limit=\d+|\/[\w-]+))$/
      : method === 'POST' ? /^\/repos\/[\w-]+\/[\w-]+\/docs$/
      : method === 'PUT' ? /^\/repos\/[\w-]+\/[\w-]+\/docs\/[\w-]+$/ : /$^/)
    : id === 'github'
    ? /^\/(?:user(?:\?|$)|user\/repos(?:\?|$)|repos\/[^/]+\/[^/]+\/(?:issues|pulls|contents)(?:\/|\?|$))/
    : id === 'slack'
      ? /^\/api\/(?:auth\.test|conversations\.list|conversations\.history|users\.info|chat\.postMessage)(?:\?|$)/
      : id === 'notion'
        ? (method === 'GET' ? /^\/(?:users\/me|pages\/[a-f0-9-]{32,36}|databases\/[a-f0-9-]{32,36}|blocks\/[a-f0-9-]{32,36}\/children(?:\?page_size=\d+)?)$/
          : method === 'POST' ? /^\/(?:search|pages|data_sources\/[a-f0-9-]{32,36}\/query)$/
          : method === 'PATCH' ? /^\/blocks\/[a-f0-9-]{32,36}\/children$/ : /$^/)
      : id === 'supabase'
        // Supabase is read-only: project list, health, and the read-only SQL endpoint.
        ? (method === 'GET' ? /^\/projects(?:$|\/[a-z0-9]{20}\/health\?services=[a-z,]+$)/ : method === 'POST' ? /^\/projects\/[a-z0-9]{20}\/database\/query\/read-only$/ : /$^/)
      // Cloudflare is read-only for now: zone list and DNS record list only.
      : (method === 'GET' ? /^\/zones(?:\?|$|\/[a-f0-9]{32}\/dns_records(?:\?|$))/ : /$^/);
  if (!allowed.test(path) || path.includes('://') || path.includes('..') || path.includes('\\')) throw new Error('不支持的服务请求');
  const headers = new Headers(init?.headers);
  if (id === 'feishu') headers.set('Authorization', `Bearer ${await feishuTenantToken(token)}`);
  else if (id === 'gitee') { headers.set('Authorization', `token ${token}`); headers.set('User-Agent', 'Oxford-Bot'); }
  else if (id === 'yuque') { headers.delete('Authorization'); headers.set('X-Auth-Token', token); headers.set('User-Agent', 'Oxford-Bot'); }
  else headers.set('Authorization', `Bearer ${token}`);
  if (id === 'notion') headers.set('Notion-Version', '2025-09-03');
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
  if (id === 'feishu' && status === 400) return '飞书请求被拒绝，请检查应用权限与资源是否已授权给应用';
  if (id === 'gitee' && status === 404) return 'Gitee 仓库或文件不存在，或当前 Token 无权访问';
  if (id === 'yuque' && status === 404) return '语雀知识库或文档不存在，或当前 Token 无权访问';
  if (slackError === 'not_in_channel') return '请先将此 Slack 账户或 Bot 加入目标频道';
  if (slackError === 'channel_not_found') return 'Slack 频道不存在或当前 Token 无权访问';
  return `${name} 请求失败（${status}），请检查服务状态与 Token 权限`;
}
export async function validatePersonalToken(id: PersonalTokenProvider, token: string) {
  if (id === 'flomo') { parseFlomoWebhook(token); return { ok: true } as Record<string, unknown>; }
  let response: Response;
  try { response = await callWithPersonalToken(id, token, VALIDATE[id]); }
  catch { throw new Error('无法访问服务，请稍后重试'); }
  if (!response.ok) throw new Error(personalTokenError(id, response.status));
  const body = await response.json().catch(() => null);
  if (!body || (id === 'feishu' ? body.code !== 0 : id === 'gitee' ? !body.id || typeof body.login !== 'string' : id === 'yuque' ? !body.data?.id || typeof body.data?.login !== 'string' : id === 'supabase' ? !Array.isArray(body) : id === 'notion' ? body.object !== 'user' : id === 'github' ? !body.id : id === 'cloudflare' ? body.success !== true : body.ok !== true)) throw new Error(personalTokenError(id, response.status, body?.error));
  return body as Record<string, unknown>;
}
/** Identify which Cloudflare account a token belongs to, so several tokens can be stored side by side. */
export async function personalTokenIdentity(id: PersonalTokenProvider, token: string, body: Record<string, unknown> | null) {
  if (id === 'cloudflare') return cloudflareAccountIdentity(token, body);
  if (id === 'feishu') {
    const bot = body?.['bot'] as { app_name?: string } | undefined;
    return { account: `fs-${parseFeishuCredential(token).appId}`, label: bot?.app_name ?? '' };
  }
  if (id === 'gitee') {
    if (!body?.['id'] || typeof body['login'] !== 'string') throw new Error('无法识别 Gitee 账户');
    return { account: `gt-${body['id']}`, label: typeof body['name'] === 'string' && body['name'] ? body['name'] : body['login'] };
  }
  if (id === 'flomo') {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parseFlomoWebhook(token)));
    return { account: 'fl-' + Array.from(new Uint8Array(digest).slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(''), label: '' };
  }
  if (id === 'yuque') {
    const user = body?.['data'] as { id?: number; login?: string; name?: string } | undefined;
    if (!user?.id || !user.login) throw new Error('无法识别语雀账户');
    return { account: `yq-${user.id}`, label: user.name || user.login };
  }
  if (id === 'notion' && body && typeof body["id"] === 'string') {
    const bot = body["bot"] as { workspace_name?: string } | undefined;
    return { account: `nt-${body["id"]}`, label: typeof bot?.workspace_name === 'string' ? bot.workspace_name : '' };
  }
  if (id === 'supabase') {
    const projects = Array.isArray(body) ? body as Array<{ organization_id?: string }> : [];
    const org = typeof projects[0]?.organization_id === 'string' ? projects[0].organization_id : '';
    const fallback = await cloudflareAccountIdentity(token, null);
    return { account: org ? `sb-${org}` : fallback.account.replace('token-', 'sb-token-'), label: '' };
  }
  if (id === 'github' && body && (typeof body["id"] === 'number' || typeof body["id"] === 'string')) return { account: `gh-${body["id"]}`, label: typeof body["login"] === 'string' ? body["login"] : '' };
  return { account: '', label: '' };
}
export async function cloudflareAccountIdentity(token: string, body: Record<string, unknown> | null) {
  const zone = Array.isArray(body?.["result"]) ? (body!["result"] as Array<{ account?: { id?: string; name?: string } }>)[0] : undefined;
  const accountId = typeof zone?.account?.id === 'string' ? zone.account.id : '';
  const accountName = typeof zone?.account?.name === 'string' ? zone.account.name : '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenKey = 'token-' + Array.from(new Uint8Array(digest).slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { account: accountId ? `cf-${accountId}` : tokenKey, label: accountName };
}
/** Feishu credentials are stored as "appId:appSecret" and exchanged for a short-lived tenant token on the fixed host. */
export function parseFeishuCredential(token: string) {
  const i = token.indexOf(':');
  const appId = i > 0 ? token.slice(0, i) : '', appSecret = i > 0 ? token.slice(i + 1) : '';
  if (!/^cli_\w+$/.test(appId) || !appSecret) throw new Error('请按 App ID:App Secret 格式输入飞书应用凭证');
  return { appId, appSecret };
}
async function feishuTenantToken(token: string) {
  const { appId, appSecret } = parseFeishuCredential(token);
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ app_id: appId, app_secret: appSecret }), redirect: 'manual' });
  const body = await res.json().catch(() => null) as { code?: number; tenant_access_token?: string } | null;
  if (!res.ok || body?.code !== 0 || !body.tenant_access_token) throw new Error('飞书应用凭证无效，请检查 App ID 与 App Secret');
  return body.tenant_access_token;
}
/** A Flomo API credential is the private webhook URL from flomo settings; only the fixed host and path shape are accepted. */
export function parseFlomoWebhook(token: string) {
  const t = token.trim();
  if (!/^https:\/\/flomoapp\.com\/iwh\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/?$/.test(t)) throw new Error('请粘贴 flomo 设置中的专属 API 链接（https://flomoapp.com/iwh/… 开头）');
  return t.endsWith('/') ? t : t + '/';
}
