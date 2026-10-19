import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { PROVIDERS } from './catalog';
import { encryptConnectionKey, decryptConnectionKey } from './storage.server';

const AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const stateSchema = z.object({ userId: z.string().uuid(), provider: z.literal('microsoft_outlook'), verifier: z.string().min(43).max(128), redirectUri: z.string().url(), expires: z.number() }).strict();
export type MicrosoftState = z.infer<typeof stateSchema>;

function config() {
  const clientId = process.env['MICROSOFT_OAUTH_CLIENT_ID'];
  const clientSecret = process.env['MICROSOFT_OAUTH_CLIENT_SECRET'];
  if (!clientId || !clientSecret) throw new Error('微软授权应用尚未配置，请联系管理员');
  return { clientId, clientSecret };
}

/** Encrypted authenticated state keeps the PKCE verifier out of the browser. */
export function startMicrosoftAuthorization(userId: string, redirectUri: string) {
  const { clientId } = config();
  const verifier = randomBytes(32).toString('base64url');
  const payload = stateSchema.parse({ userId, provider: 'microsoft_outlook', verifier, redirectUri, expires: Date.now() + 10 * 60 * 1000 });
  const state = encryptConnectionKey(JSON.stringify(payload), 'microsoft_oauth');
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', response_mode: 'query', scope: PROVIDERS.microsoft_outlook.scopes.join(' '), prompt: 'select_account', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  return { authorizationUrl: `${AUTH_URL}?${params}` };
}

export function verifyMicrosoftState(state: string): MicrosoftState {
  if (!state || state.length > 4096) throw new Error('微软授权状态无效');
  const payload = stateSchema.parse(JSON.parse(decryptConnectionKey(state, 'microsoft_oauth')));
  if (payload.expires <= Date.now()) throw new Error('微软授权已过期，请重新连接');
  return payload;
}

export class MicrosoftReconnectError extends Error {
  constructor() { super('微软授权需要更新，请重新连接'); }
}

type Tokens = { access_token: string; refresh_token?: string };
async function tokens(fields: Record<string, string>): Promise<Tokens> {
  const { clientId, clientSecret } = config();
  const response = await fetch(TOKEN_URL, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...fields, client_id: clientId, client_secret: clientSecret }) });
  const body = await response.json().catch(() => null) as { access_token?: string; refresh_token?: string; error?: string } | null;
  if (!response.ok || !body?.access_token) {
    if (fields.grant_type === 'refresh_token' && body?.error === 'invalid_grant') throw new MicrosoftReconnectError();
    // Do not log token endpoint bodies: they can include credentials.
    throw new Error(`微软授权失败 (${response.status})${body?.error ? `：${body.error}` : ''}`);
  }
  return { access_token: body.access_token, ...(body.refresh_token ? { refresh_token: body.refresh_token } : {}) };
}

export async function exchangeMicrosoftCode(code: string, state: MicrosoftState) {
  const result = await tokens({ grant_type: 'authorization_code', code, redirect_uri: state.redirectUri, code_verifier: state.verifier });
  if (!result.refresh_token) throw new Error('微软未授予持续访问，请重新授权');
  return { accessToken: result.access_token, refreshToken: result.refresh_token };
}

export async function getMicrosoftAccount(accessToken: string) {
  const response = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName,displayName', { redirect: 'manual', headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`无法读取微软账户 (${response.status})`);
  const body = await response.json() as { id?: string; mail?: string; userPrincipalName?: string; displayName?: string };
  if (!body.id) throw new Error('微软账户标识缺失');
  return { account: `microsoft:${body.id}`.toLowerCase(), label: body.mail || body.userPrincipalName || body.displayName || body.id };
}

/** Only mail and identity endpoints are allowed; caller cannot change the host or follow redirects. */
export async function callWithMicrosoftToken(refreshToken: string, path: string, init?: RequestInit, rotate?: (refreshToken: string) => Promise<void>) {
  const method = (init?.method ?? 'GET').toUpperCase();
  if (!path.startsWith('/') || /[\\\r\n#]/.test(path) || path.includes('://') || path.includes('..') || /%(?:2e|2f|5c)/i.test(path)) throw new Error('不支持的微软请求路径');
  const url = new URL(`https://graph.microsoft.com/v1.0${path}`);
  const endpoint = url.pathname.slice('/v1.0'.length);
  const allowed = method === 'GET' ? /^\/me(?:\/messages(?:\/[^/]+)?)?$/.test(endpoint) : method === 'POST' && ['/me/messages', '/me/sendMail'].includes(endpoint);
  if (!allowed || url.origin !== 'https://graph.microsoft.com') throw new Error('不支持的微软请求路径');
  const result = await tokens({ grant_type: 'refresh_token', refresh_token: refreshToken, scope: PROVIDERS.microsoft_outlook.scopes.join(' ') });
  if (result.refresh_token && result.refresh_token !== refreshToken && rotate) await rotate(result.refresh_token);
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${result.access_token}`);
  const response = await fetch(url.toString(), { ...init, headers, redirect: 'manual' });
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) return Response.json({ error: 'unexpected_redirect' }, { status: 502 });
  return response;
}