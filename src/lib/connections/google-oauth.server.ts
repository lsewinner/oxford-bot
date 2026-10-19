import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PROVIDERS, type ProviderId } from './catalog';
import { resolveConnectionSecret } from './connection-secret.server';

export type GoogleProvider = 'google_mail' | 'google_drive';
export const isGoogleProvider = (id: ProviderId): id is GoogleProvider => id === 'google_mail' || id === 'google_drive';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const HOSTS: Record<GoogleProvider, string> = { google_mail: 'https://gmail.googleapis.com', google_drive: 'https://www.googleapis.com' };

function stateKey(): string {
  return resolveConnectionSecret('connection');
}

interface StatePayload { u: string; p: GoogleProvider; n: string; e: number }

export function signState(userId: string, provider: GoogleProvider): string {
  const payload: StatePayload = { u: userId, p: provider, n: randomBytes(16).toString('hex'), e: Date.now() + 10 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', stateKey()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyState(state: string): StatePayload {
  const [body, sig] = state.split('.');
  if (!body || !sig) throw new Error('授权状态无效');
  const expected = createHmac('sha256', stateKey()).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('授权状态校验失败');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
  if (!payload.u || !isGoogleProvider(payload.p) || payload.e < Date.now()) throw new Error('授权状态已过期，请重试');
  return payload;
}

function clientConfig() {
  const clientId = process.env['GOOGLE_OAUTH_CLIENT_ID'];
  const clientSecret = process.env['GOOGLE_OAUTH_CLIENT_SECRET'];
  if (!clientId || !clientSecret) throw new Error('Google 授权应用尚未配置');
  return { clientId, clientSecret };
}

export function buildGoogleAuthUrl(provider: GoogleProvider, redirectUri: string, state: string): string {
  const { clientId } = clientConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: PROVIDERS[provider].scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<string> {
  const { clientId, clientSecret } = clientConfig();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  const body = (await res.json().catch(() => null)) as { refresh_token?: string; error?: string } | null;
  if (!res.ok || !body?.refresh_token) throw new Error(`Google 授权换取失败${body?.error ? `：${body.error}` : ''}`);
  return body.refresh_token;
}

export async function getGoogleAccessToken(refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = clientConfig();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token' }),
  });
  const body = (await res.json().catch(() => null)) as { access_token?: string; error?: string } | null;
  if (!res.ok || !body?.access_token) {
    if (body?.error === 'invalid_grant') throw new GoogleReconnectError();
    throw new Error(`Google 访问凭据刷新失败 (${res.status})`);
  }
  return body.access_token;
}

export class GoogleReconnectError extends Error {
  constructor() { super('Google 授权需要更新，请重新连接'); }
}

/** Call a Google API path (e.g. /gmail/v1/..., /drive/v3/..., /upload/drive/v3/...) with the user's refresh token. */
export async function callWithGoogleToken(provider: GoogleProvider, refreshToken: string, path: string, init?: RequestInit): Promise<Response> {
  if (path.includes('://') || path.includes('..') || path.includes('\\')) throw new Error('不支持的请求路径');
  const accessToken = await getGoogleAccessToken(refreshToken);
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(`${HOSTS[provider]}${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers, redirect: 'manual' });
  // Never follow redirects off the fixed provider host; surface them as a gateway error.
  if (res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) return new Response(JSON.stringify({ error: 'unexpected_redirect' }), { status: 502, headers: { 'content-type': 'application/json' } });
  return res;
}
