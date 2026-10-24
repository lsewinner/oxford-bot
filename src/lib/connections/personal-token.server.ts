import type { ProviderId } from './catalog';

export type PersonalTokenProvider = 'github' | 'slack' | 'cloudflare' | 'supabase' | 'notion' | 'yuque' | 'feishu' | 'gitee' | 'airtable' | 'clickup' | 'telegram' | 'asana' | 'jira' | 'oanda' | 'discord' | 'x';
export function supportsPersonalToken(id: ProviderId): id is PersonalTokenProvider { return id === 'github' || id === 'slack' || id === 'cloudflare' || id === 'supabase' || id === 'notion' || id === 'yuque' || id === 'feishu' || id === 'gitee' || id === 'airtable' || id === 'clickup' || id === 'telegram' || id === 'asana' || id === 'jira' || id === 'oanda' || id === 'discord' || id === 'x'; }
const HOSTS = { github: 'https://api.github.com', slack: 'https://slack.com', cloudflare: 'https://api.cloudflare.com/client/v4', supabase: 'https://api.supabase.com/v1', notion: 'https://api.notion.com/v1', yuque: 'https://www.yuque.com/api/v2', feishu: 'https://open.feishu.cn/open-apis', gitee: 'https://gitee.com/api/v5', airtable: 'https://api.airtable.com', clickup: 'https://api.clickup.com', telegram: 'https://api.telegram.org', asana: 'https://app.asana.com/api/1.0', jira: '', oanda: '', discord: 'https://discord.com/api/v10', x: 'https://api.x.com/2' } as const;
const NAMES = { github: 'GitHub', slack: 'Slack', cloudflare: 'Cloudflare', supabase: 'Supabase', notion: 'Notion', yuque: '语雀', feishu: '飞书', gitee: 'Gitee', airtable: 'Airtable', clickup: 'ClickUp', telegram: 'Telegram', asana: 'Asana', jira: 'Jira', oanda: 'OANDA', discord: 'Discord', x: 'X' } as const;
const VALIDATE = { github: '/user', slack: '/api/auth.test', cloudflare: '/zones?per_page=1', supabase: '/projects', notion: '/users/me', yuque: '/user', feishu: '/bot/v3/info', gitee: '/user', airtable: '/v0/meta/whoami', clickup: '/api/v2/user', telegram: '/getMe', asana: '/users/me', jira: '/rest/api/3/myself', oanda: '/v3/accounts', discord: '/users/@me', x: '/users/by/username/XDevelopers' } as const;
export async function callWithPersonalToken(id: PersonalTokenProvider, token: string, path: string, init?: RequestInit, oauth?: { bearer?: true; jiraCloudId?: string }): Promise<Response> {
  if (oauth?.jiraCloudId !== undefined && (id !== 'jira' || !/^[0-9a-f-]{36}$/.test(oauth.jiraCloudId))) throw new Error('Jira 站点标识无效');
  const method = (init?.method ?? 'GET').toUpperCase();
  const allowed = id === 'feishu'
    // Feishu: wiki/docx/bitable reads plus confirmed bitable record creation only.
    ? (method === 'GET' ? /^\/(?:bot\/v3\/info|wiki\/v2\/spaces\?page_size=\d+|wiki\/v2\/spaces\/\w+\/nodes\?page_size=\d+(?:&parent_node_token=\w+)?|docx\/v1\/documents\/\w+\/raw_content|bitable\/v1\/apps\/\w+\/tables\?page_size=\d+|bitable\/v1\/apps\/\w+\/tables\/\w+\/records\?page_size=\d+)$/
      : method === 'POST' ? /^\/bitable\/v1\/apps\/\w+\/tables\/\w+\/records$/ : /$^/)
    : id === 'gitee'
    // Gitee: user, repos, issues, file contents; confirmed issue creation only.
    ? (method === 'GET' ? /^\/(?:user|user\/repos\?per_page=\d+&sort=updated|repos\/[\w.-]+\/[\w.-]+\/(?:issues\?state=open&per_page=\d+|contents\/[^?#]+))$/
      : method === 'POST' ? /^\/repos\/[\w.-]+\/issues$/ : /$^/)
    : id === 'airtable'
    // Airtable: whoami, base/table metadata, record lists; confirmed record creation only.
    ? (method === 'GET' ? /^\/v0\/(?:meta\/whoami|meta\/bases(?:\?[\w%&=.+-]{0,300})?|meta\/bases\/app[A-Za-z0-9]{14}\/tables|app[A-Za-z0-9]{14}\/[\w%~.+-]{1,170}(?:\?[\w%&=.+-]{0,300})?)$/
      : method === 'POST' ? /^\/v0\/app[A-Za-z0-9]{14}\/[\w%~.+-]{1,170}$/ : /$^/)
    : id === 'clickup'
    // ClickUp: bounded workspace hierarchy reads; only confirmed list-level task creation.
    ? (method === 'GET' ? /^\/api\/v2\/(?:user|team|team\/\d{1,20}\/(?:task|space)(?:\?[\w%&=.+-]{0,300})?|space\/\d{1,20}\/(?:folder|list)(?:\?[\w%&=.+-]{0,300})?|folder\/\d{1,20}\/list(?:\?[\w%&=.+-]{0,300})?)$/
      : method === 'POST' ? /^\/api\/v2\/list\/\d{1,20}\/task$/ : /$^/)
    : id === 'discord'
    // Discord Bot: identity, guilds, channels, recent messages; confirmed channel posts only.
    ? (method === 'GET' ? /^\/(?:users\/@me(?:\/guilds)?|guilds\/\d{15,22}\/channels|channels\/\d{15,22}\/messages\?limit=\d{1,3})$/ : method === 'POST' ? /^\/channels\/\d{15,22}\/messages$/ : /$^/)
    : id === 'x'
    // X API v2 app-only bearer: read-only recent search, user lookup and user timelines.
    ? (method === 'GET' ? /^\/(?:tweets\/search\/recent\?[\w%&=.+*:-]{1,1500}|users\/by\/username\/\w{1,15}(?:\?[\w%&=.,-]{0,200})?|users\/\d{1,25}\/tweets\?[\w%&=.,-]{1,400})$/ : /$^/)
    : id === 'telegram'
    // Telegram Bot: identity, recent updates; confirmed sendMessage only.
    ? (method === 'GET' ? /^\/(?:getMe|getUpdates\?limit=\d{1,3})$/ : method === 'POST' ? /^\/sendMessage$/ : /$^/)
    : id === 'asana'
    // Asana: me, workspaces, projects, tasks; confirmed task creation only.
    ? (method === 'GET' ? /^\/(?:users\/me|workspaces\?limit=\d{1,3}|projects\?workspace=\d{1,20}&limit=\d{1,3}&archived=false|tasks\?project=\d{1,20}&limit=\d{1,3}&opt_fields=[\w.,]+)$/
      : method === 'POST' ? /^\/tasks$/ : /$^/)
    : id === 'oanda'
    // OANDA v20: account reads and pricing; confirmed order placement, closes and cancels only.
    ? (method === 'GET' ? /^\/v3\/accounts(?:\/\d{3}-\d{3}-\d{1,12}-\d{3}\/(?:summary|openPositions|openTrades|pendingOrders|pricing\?instruments=[A-Z0-9_,]{5,220}))?$/
      : method === 'POST' ? /^\/v3\/accounts\/\d{3}-\d{3}-\d{1,12}-\d{3}\/orders$/
      : method === 'PUT' ? /^\/v3\/accounts\/\d{3}-\d{3}-\d{1,12}-\d{3}\/(?:positions\/[A-Z0-9]{2,10}_[A-Z0-9]{2,10}\/close|trades\/\d{1,20}\/close|orders\/\d{1,20}\/cancel)$/ : /$^/)
    : id === 'jira'
    // Jira Cloud: myself, projects, JQL search, issue detail; confirmed issue creation only.
    ? (method === 'GET' ? /^\/rest\/api\/3\/(?:myself|project\/search\?maxResults=\d{1,3}|search\/jql\?[\w%&=.!~*'()+-]{0,1500}|issue\/[A-Z][A-Z0-9_]{0,20}-\d{1,9}\?fields=[\w,]+)$/
      : method === 'POST' ? /^\/rest\/api\/3\/issue$/ : /$^/)
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
  else if (id === 'clickup') { headers.set('Authorization', token); headers.set('User-Agent', 'Oxford-Bot'); }
  else if (oauth) headers.set('Authorization', `Bearer ${token}`);
  else if (id === 'jira') { const j = parseJiraCredential(token); headers.set('Authorization', `Basic ${btoa(`${j.email}:${j.apiToken}`)}`); }
  else if (id === 'telegram') { headers.delete('Authorization'); }
  else if (id === 'discord') { headers.set('Authorization', `Bot ${token}`); headers.set('User-Agent', 'DiscordBot (https://oxford.bot, 1.0)'); }
  else if (id === 'oanda') { headers.set('Authorization', `Bearer ${parseOandaCredential(token).token}`); }
  else if (id === 'yuque') { headers.delete('Authorization'); headers.set('X-Auth-Token', token); headers.set('User-Agent', 'Oxford-Bot'); }
  else headers.set('Authorization', `Bearer ${token}`);
  if (id === 'notion') headers.set('Notion-Version', '2025-09-03');
  if (id === 'github') { headers.set('Accept', 'application/vnd.github+json'); headers.set('X-GitHub-Api-Version', '2022-11-28'); headers.set('User-Agent', 'Oxford-Bot'); }
  const base = oauth?.jiraCloudId ? `https://api.atlassian.com/ex/jira/${oauth.jiraCloudId}` : id === 'jira' ? `https://${parseJiraCredential(token).site}` : id === 'oanda' ? oandaHost(parseOandaCredential(token).env) : id === 'telegram' ? `${HOSTS.telegram}/bot${telegramToken(token)}` : HOSTS[id];
  const res = await fetch(`${base}${path}`, { ...init, headers, redirect: 'manual' });
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
  if (id === 'airtable' && status === 404) return 'Airtable base 或数据表不存在，或当前令牌无权访问';
  if (id === 'clickup' && status === 404) return 'ClickUp 团队或任务不存在，或当前令牌无权访问';
  if (id === 'oanda' && status === 404) return 'OANDA 账户、品种或订单不存在，或当前令牌无权访问（模拟盘/实盘环境是否选对？）';
  if (id === 'oanda' && status === 400) return 'OANDA 拒绝请求：请检查数量、价格、止损止盈与品种是否有效';
  if (id === 'discord' && status === 403) return 'Discord Bot 没有该频道的查看或发言权限，请在服务器里给 Bot 授权';
  if (id === 'discord' && status === 404) return 'Discord 服务器或频道不存在，或 Bot 未加入该服务器';
  if (id === 'x' && status === 429) return 'X 接口额度已用完（免费档每月读取很少），请稍后或升级 X 开发者套餐';
  if (id === 'x' && status === 403) return 'X 开发者套餐不包含此接口（搜索需 Basic 及以上档位）';
  if (id === 'telegram' && status === 404) return 'Telegram Bot Token 无效，请重新输入';
  if (id === 'telegram' && status === 400) return 'Telegram 拒绝请求：请确认聊天 ID 正确，且对方已先给 Bot 发过消息';
  if (id === 'asana' && status === 404) return 'Asana 工作区、项目或任务不存在，或当前令牌无权访问';
  if (id === 'jira' && status === 404) return 'Jira 站点、项目或 Issue 不存在，或当前账户无权访问';
  if (id === 'jira' && status === 400) return 'Jira 拒绝请求：请检查项目 Key、JQL 或 Issue 类型';
  if (id === 'yuque' && status === 404) return '语雀知识库或文档不存在，或当前 Token 无权访问';
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
  if (!body || (id === 'discord' ? !body.id || !body.bot : id === 'x' ? !body.data?.id : id === 'oanda' ? !Array.isArray(body.accounts) || !body.accounts.length : id === 'telegram' ? body.ok !== true || !body.result?.id : id === 'asana' ? !body.data?.gid : id === 'jira' ? typeof body.accountId !== 'string' : id === 'airtable' ? !(typeof body['id'] === 'string' && /^usr[A-Za-z0-9]+$/.test(body['id'])) : id === 'clickup' ? !body.user?.id : id === 'feishu' ? body.code !== 0 : id === 'gitee' ? !body.id || typeof body.login !== 'string' : id === 'yuque' ? !body.data?.id || typeof body.data?.login !== 'string' : id === 'supabase' ? !Array.isArray(body) : id === 'notion' ? body.object !== 'user' : id === 'github' ? !body.id : id === 'cloudflare' ? body.success !== true : body.ok !== true)) throw new Error(personalTokenError(id, response.status, body?.error));
  return body as Record<string, unknown>;
}
/** Identify which Cloudflare account a token belongs to, so several tokens can be stored side by side. */
export async function personalTokenIdentity(id: PersonalTokenProvider, token: string, body: Record<string, unknown> | null) {
  if (id === 'cloudflare') return cloudflareAccountIdentity(token, body);
  if (id === 'airtable') {
    if (typeof body?.['id'] !== 'string' || !/^usr[A-Za-z0-9]+$/.test(body['id'])) throw new Error('无法识别 Airtable 账户');
    return { account: `at-${body['id']}`, label: typeof body['email'] === 'string' ? body['email'] : '' };
  }
  if (id === 'clickup') {
    const user = body?.['user'] as { id?: number; username?: string } | undefined;
    if (!user?.id) throw new Error('无法识别 ClickUp 账户');
    return { account: `cu-${user.id}`, label: typeof user.username === 'string' ? user.username : '' };
  }
  if (id === 'oanda') {
    const accounts = (body?.['accounts'] as Array<{ id?: string }> | undefined) ?? [];
    const first = accounts.find(a => typeof a.id === 'string' && /^\d{3}-\d{3}-\d{1,12}-\d{3}$/.test(a.id))?.id;
    if (!first) throw new Error('无法识别 OANDA 账户');
    const env = parseOandaCredential(token).env;
    return { account: `oa-${env}-${first}`, label: `${env === 'live' ? '实盘' : '模拟盘'} · ${first}${accounts.length > 1 ? ` 等 ${accounts.length} 个账户` : ''}` };
  }
  if (id === 'discord') {
    if (typeof body?.['id'] !== 'string') throw new Error('无法识别 Discord Bot');
    return { account: `dc-${body['id']}`, label: typeof body['username'] === 'string' ? body['username'] : '' };
  }
  if (id === 'x') {
    let h = 0; for (const c of token) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return { account: `x-${h.toString(36)}`, label: 'X 开发者应用' };
  }
  if (id === 'telegram') {
    const bot = body?.['result'] as { id?: number; username?: string } | undefined;
    if (!bot?.id) throw new Error('无法识别 Telegram Bot');
    return { account: `tg-${bot.id}`, label: bot.username ? `@${bot.username}` : '' };
  }
  if (id === 'asana') {
    const user = body?.['data'] as { gid?: string; email?: string; name?: string } | undefined;
    if (!user?.gid) throw new Error('无法识别 Asana 账户');
    return { account: `as-${user.gid}`, label: user.email || user.name || '' };
  }
  if (id === 'jira') {
    if (typeof body?.['accountId'] !== 'string') throw new Error('无法识别 Jira 账户');
    const site = parseJiraCredential(token).site;
    return { account: `jr-${body['accountId']}@${site.split('.')[0]}`.slice(0, 300), label: `${typeof body['emailAddress'] === 'string' ? body['emailAddress'] : (body['displayName'] ?? '')} @ ${site}` };
  }
  if (id === 'feishu') {
    const bot = body?.['bot'] as { app_name?: string } | undefined;
    return { account: `fs-${parseFeishuCredential(token).appId}`, label: bot?.app_name ?? '' };
  }
  if (id === 'gitee') {
    if (!body?.['id'] || typeof body['login'] !== 'string') throw new Error('无法识别 Gitee 账户');
    return { account: `gt-${body['id']}`, label: typeof body['name'] === 'string' && body['name'] ? body['name'] : body['login'] };
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

/** Telegram Bot tokens look like 123456:ABC-def; the token is part of the URL path, so it must be strictly shaped. */
export function telegramToken(token: string) {
  if (!/^\d{5,15}:[\w-]{30,60}$/.test(token)) throw new Error('Telegram Bot Token 格式无效（应为 数字:字母串）');
  return token;
}
/** Jira credentials are stored as "site.atlassian.net|email|apiToken"; only *.atlassian.net hosts are accepted. */
export function parseJiraCredential(token: string) {
  const [rawSite = '', email = '', apiToken = '', ...rest] = token.split('|');
  const site = rawSite.toLowerCase().replace(/^https:\/\//, '').replace(/\/+$/, '');
  if (rest.length || !/^[a-z0-9][a-z0-9-]{0,62}\.atlassian\.net$/.test(site) || !/^[^\s@|]+@[^\s@|]+\.[^\s@|]+$/.test(email) || !apiToken) throw new Error('请按 站点|邮箱|API 令牌 格式输入 Jira 凭证（站点如 your-team.atlassian.net）');
  return { site, email, apiToken };
}

/** OANDA credentials are stored as "practice|token" or "live|token"; only the two fixed OANDA v20 hosts are used. */
export function parseOandaCredential(token: string) {
  const i = token.indexOf('|');
  const env = i > 0 ? token.slice(0, i) : 'practice', raw = i > 0 ? token.slice(i + 1) : token;
  if ((env !== 'practice' && env !== 'live') || !/^[A-Za-z0-9-]{20,200}$/.test(raw)) throw new Error('OANDA 令牌格式无效');
  return { env: env as 'practice' | 'live', token: raw };
}
export function oandaHost(env: 'practice' | 'live') { return env === 'live' ? 'https://api-fxtrade.oanda.com' : 'https://api-fxpractice.oanda.com'; }
