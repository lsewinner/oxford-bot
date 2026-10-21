import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { resolveConnectionSecret } from './connection-secret.server';

const AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

interface StatePayload { u: string; p: 'notion'; n: string; e: number }

export function notionConfigured(): boolean {
  return Boolean(process.env['NOTION_OAUTH_CLIENT_ID'] && process.env['NOTION_OAUTH_CLIENT_SECRET']);
}

function clientConfig() {
  const clientId = process.env['NOTION_OAUTH_CLIENT_ID'];
  const clientSecret = process.env['NOTION_OAUTH_CLIENT_SECRET'];
  if (!clientId || !clientSecret) throw new Error('Notion 一键授权尚未配置');
  return { clientId, clientSecret };
}

export function signNotionState(userId: string): string {
  const payload: StatePayload = { u: userId, p: 'notion', n: randomBytes(16).toString('hex'), e: Date.now() + 10 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', resolveConnectionSecret('connection')).update(`notion.${body}`).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyNotionState(state: string): StatePayload {
  const [body, sig] = state.split('.');
  if (!body || !sig) throw new Error('授权状态无效');
  const expected = createHmac('sha256', resolveConnectionSecret('connection')).update(`notion.${body}`).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('授权状态校验失败');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
  if (!payload.u || payload.p !== 'notion' || payload.e < Date.now()) throw new Error('授权状态已过期，请重试');
  return payload;
}

export function buildNotionAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = clientConfig();
  const params = new URLSearchParams({ client_id: clientId, response_type: 'code', owner: 'user', redirect_uri: redirectUri, state });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Exchanges the code for a workspace access token; the token works with the same fixed-host API path as integration tokens. */
export async function exchangeNotionCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = clientConfig();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/json', 'Notion-Version': '2025-09-03' },
    body: JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    redirect: 'manual',
  });
  const body = (await res.json().catch(() => null)) as { access_token?: string; workspace_id?: string; workspace_name?: string; error?: string } | null;
  if (!res.ok || !body?.access_token || !body.workspace_id) throw new Error(`Notion 授权换取失败${body?.error ? `：${body.error}` : ''}`);
  return { token: body.access_token, account: `nt-ws-${body.workspace_id}`, label: body.workspace_name ?? '' };
}
