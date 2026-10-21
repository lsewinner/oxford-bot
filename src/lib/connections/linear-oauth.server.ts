import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { resolveConnectionSecret } from './connection-secret.server';

const AUTH_URL = 'https://linear.app/oauth/authorize';
const TOKEN_URL = 'https://api.linear.app/oauth/token';
const REVOKE_URL = 'https://api.linear.app/oauth/revoke';
const API_URL = 'https://api.linear.app/graphql';

/** Linear lists scopes comma separated on /authorize; write plus the two create scopes keep the app read-mostly. */
export const LINEAR_SCOPES = ['read', 'write', 'issues:create', 'comments:create'];

/** Shared by the status probe and the execute path so both read the same identity. */
export const LINEAR_VIEWER_QUERY = 'query LinearViewer { viewer { id name email } organization { id name } }';

interface StatePayload { u: string; p: 'linear'; n: string; e: number }

export function linearOAuthConfigured(): boolean {
  return Boolean(process.env['LINEAR_OAUTH_CLIENT_ID'] && process.env['LINEAR_OAUTH_CLIENT_SECRET']);
}

function clientConfig() {
  const clientId = process.env['LINEAR_OAUTH_CLIENT_ID'];
  const clientSecret = process.env['LINEAR_OAUTH_CLIENT_SECRET'];
  if (!clientId || !clientSecret) throw new Error('Linear 一键授权尚未配置');
  return { clientId, clientSecret };
}

export function signLinearState(userId: string): string {
  const payload: StatePayload = { u: userId, p: 'linear', n: randomBytes(16).toString('hex'), e: Date.now() + 10 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', resolveConnectionSecret('connection')).update(`linear.${body}`).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyLinearState(state: string): StatePayload {
  const [body, sig] = state.split('.');
  if (!body || !sig) throw new Error('授权状态无效');
  const expected = createHmac('sha256', resolveConnectionSecret('connection')).update(`linear.${body}`).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('授权状态校验失败');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
  if (!payload.u || payload.p !== 'linear' || payload.e < Date.now()) throw new Error('授权状态已过期，请重试');
  return payload;
}

/** prompt=consent keeps the workspace picker available so one Oxford Bot account can hold several Linear workspaces. */
export function buildLinearAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = clientConfig();
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: LINEAR_SCOPES.join(','), state, prompt: 'consent' });
  return `${AUTH_URL}?${params.toString()}`;
}

export class LinearReconnectError extends Error {
  constructor() { super('Linear 授权需要更新，请重新连接'); }
}

type Tokens = { access_token: string; refresh_token?: string };

/** Linear's token endpoint only accepts URL-encoded form bodies, never JSON. */
async function tokens(fields: Record<string, string>): Promise<Tokens> {
  const { clientId, clientSecret } = clientConfig();
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ ...fields, client_id: clientId, client_secret: clientSecret }),
  });
  const body = (await response.json().catch(() => null)) as { access_token?: string; refresh_token?: string; error?: string; error_description?: string } | null;
  if (!response.ok || !body?.access_token) {
    // A dead refresh token is the only case we can recover from by asking the user to re-authorize.
    if (fields['grant_type'] === 'refresh_token' && (body?.error === 'invalid_grant' || response.status === 401)) throw new LinearReconnectError();
    // Token endpoint bodies can carry credentials, so only the provider error code is surfaced.
    throw new Error(`Linear 授权失败 (${response.status})${body?.error ? `：${body.error_description ?? body.error}` : ''}`);
  }
  return { access_token: body.access_token, ...(body.refresh_token ? { refresh_token: body.refresh_token } : {}) };
}

export async function exchangeLinearCode(code: string, redirectUri: string) {
  const result = await tokens({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  if (!result.refresh_token) throw new Error('Linear 未授予持续访问，请重新授权');
  return { accessToken: result.access_token, refreshToken: result.refresh_token };
}

/**
 * Runs one GraphQL request against the fixed Linear endpoint.
 * Access tokens last 24 hours, so every call mints a fresh one and stores the rotated refresh token.
 */
export async function callLinearGraphQL(refreshToken: string, query: string, variables?: Record<string, unknown>, rotate?: (refreshToken: string) => Promise<void>) {
  const result = await tokens({ grant_type: 'refresh_token', refresh_token: refreshToken });
  if (result.refresh_token && result.refresh_token !== refreshToken && rotate) await rotate(result.refresh_token);
  const response = await fetch(API_URL, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${result.access_token}` },
    body: JSON.stringify({ query, ...(variables ? { variables } : {}) }),
  });
  if (response.status === 401) throw new LinearReconnectError();
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) return Response.json({ error: 'unexpected_redirect' }, { status: 502 });
  return response;
}

/** Workspaces are the account boundary: one Linear user can belong to several organizations. */
export async function getLinearAccount(accessToken: string) {
  const response = await fetch(API_URL, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ query: LINEAR_VIEWER_QUERY }),
  });
  if (response.status === 401) throw new LinearReconnectError();
  if (!response.ok) throw new Error(`无法读取 Linear 账户 (${response.status})`);
  const body = (await response.json().catch(() => null)) as { data?: { viewer?: { id?: string; name?: string; email?: string }; organization?: { id?: string; name?: string } }; errors?: { message?: string }[] } | null;
  if (body?.errors?.length) throw new Error(`Linear：${body.errors[0]?.message ?? '请求失败'}`);
  const viewer = body?.data?.viewer, organization = body?.data?.organization;
  if (!viewer?.id || !organization?.id) throw new Error('Linear 账户标识缺失');
  return { account: `ln-${organization.id}`.toLowerCase(), label: [organization.name, viewer.name].filter(Boolean).join(' · ') };
}

/** Best-effort revocation before dropping a stored connection; Linear rejects already-dead tokens silently. */
export async function revokeLinearToken(token: string) {
  try {
    await fetch(REVOKE_URL, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token, token_type_hint: 'refresh_token' }) });
  } catch {
    // The local row is deleted regardless; revocation is a courtesy to Linear.
  }
}
