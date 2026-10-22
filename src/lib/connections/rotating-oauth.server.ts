import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { encryptConnectionKey, decryptConnectionKey, replaceRotatingCredential, getConnection } from './storage.server';
import { callWithPersonalToken, personalTokenIdentity } from './personal-token.server';

/** Asana and Jira one-click OAuth: short-lived access tokens refreshed under an owner-scoped CAS lease. */
export type RotatingProvider = 'asana' | 'jira';
export const ROTATING_CALLBACK = { asana: '/api/public/connections/asana/callback', jira: '/api/public/connections/jira/callback' } as const;
const NAME = { asana: 'Asana', jira: 'Jira' } as const;
const JIRA_SCOPES = ['read:jira-work', 'write:jira-work', 'read:jira-user', 'offline_access'];
const stateSchema = z.object({ userId: z.string().uuid(), provider: z.enum(['asana', 'jira']), verifier: z.string().min(43).max(128), redirectUri: z.string().url(), expires: z.number() }).strict();
const credentialSchema = z.object({ provider: z.enum(['asana_oauth', 'jira_oauth']), accessToken: z.string().min(1), refreshToken: z.string().min(1), expiresAt: z.number(), cloudId: z.string().uuid().optional(), refreshingUntil: z.number().optional() }).strict();
type Credential = z.infer<typeof credentialSchema>;
export type RotatingState = z.infer<typeof stateSchema>;
const ENV = { asana: 'ASANA', jira: 'JIRA' } as const;

export function rotatingConfigured(id: RotatingProvider) { return Boolean(process.env[`${ENV[id]}_OAUTH_CLIENT_ID`]?.trim() && process.env[`${ENV[id]}_OAUTH_CLIENT_SECRET`]?.trim()); }
function config(id: RotatingProvider) {
  const clientId = process.env[`${ENV[id]}_OAUTH_CLIENT_ID`]?.trim();
  const clientSecret = process.env[`${ENV[id]}_OAUTH_CLIENT_SECRET`]?.trim();
  if (!clientId || !clientSecret) throw new Error(`${NAME[id]} 一键授权尚未配置`);
  return { clientId, clientSecret };
}
export class RotatingReconnectError extends Error {
  constructor(id: RotatingProvider) { super(`${NAME[id]} 授权已失效，请重新连接`); }
}
export function startRotatingAuthorization(id: RotatingProvider, userId: string, redirectUri: string) {
  const { clientId } = config(id);
  const verifier = randomBytes(32).toString('base64url');
  const state = encryptConnectionKey(JSON.stringify(stateSchema.parse({ userId, provider: id, verifier, redirectUri, expires: Date.now() + 600000 })), 'personal_token');
  if (id === 'asana') {
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
    return { authorizationUrl: `https://app.asana.com/-/oauth_authorize?${params}` };
  }
  const params = new URLSearchParams({ audience: 'api.atlassian.com', client_id: clientId, scope: JIRA_SCOPES.join(' '), redirect_uri: redirectUri, state, response_type: 'code', prompt: 'consent' });
  return { authorizationUrl: `https://auth.atlassian.com/authorize?${params}` };
}
export function verifyRotatingState(id: RotatingProvider, state: string): RotatingState {
  if (!state || state.length > 4096) throw new Error(`${NAME[id]} 授权状态无效`);
  const payload = stateSchema.parse(JSON.parse(decryptConnectionKey(state, 'personal_token')));
  if (payload.provider !== id) throw new Error(`${NAME[id]} 授权状态无效`);
  if (payload.expires <= Date.now()) throw new Error(`${NAME[id]} 授权已过期，请重试`);
  return payload;
}
async function requestTokens(id: RotatingProvider, fields: Record<string, string>, previous?: Credential): Promise<Credential> {
  const { clientId, clientSecret } = config(id);
  const all = { ...fields, client_id: clientId, client_secret: clientSecret };
  const response = id === 'asana'
    ? await fetch('https://app.asana.com/-/oauth_token', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(all) })
    : await fetch('https://auth.atlassian.com/oauth/token', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(all) });
  const body = await response.json().catch(() => null) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string } | null;
  // Asana keeps the original refresh token; Atlassian rotates it on every refresh.
  const refreshToken = body?.refresh_token ?? previous?.refreshToken;
  if (!response.ok || !body?.access_token || !refreshToken || typeof body.expires_in !== 'number' || body.expires_in <= 0) {
    if (fields['grant_type'] === 'refresh_token' && (body?.error === 'invalid_grant' || response.status === 401 || response.status === 403)) throw new RotatingReconnectError(id);
    // Never log token responses.
    throw new Error(`${NAME[id]} 授权失败 (${response.status})${body?.error === 'invalid_client' || body?.error === 'unauthorized_client' ? '：请检查开发者凭证' : ''}`);
  }
  return { provider: id === 'asana' ? 'asana_oauth' : 'jira_oauth', accessToken: body.access_token, refreshToken, expiresAt: Date.now() + body.expires_in * 1000, ...(previous?.cloudId ? { cloudId: previous.cloudId } : {}) };
}
export async function exchangeRotatingCode(id: RotatingProvider, code: string, state: RotatingState) {
  const fields: Record<string, string> = { grant_type: 'authorization_code', code, redirect_uri: state.redirectUri };
  if (id === 'asana') fields['code_verifier'] = state.verifier;
  let credential = await requestTokens(id, fields);
  let site = '';
  if (id === 'jira') {
    const res = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', { headers: { Authorization: `Bearer ${credential.accessToken}`, Accept: 'application/json' }, redirect: 'manual' });
    const sites = res.ok ? await res.json().catch(() => []) as Array<{ id?: string; url?: string }> : [];
    const first = sites.find(s => typeof s.id === 'string' && /^https:\/\/[a-z0-9-]+\.atlassian\.net\/?$/.test(s.url ?? ''));
    if (!first?.id) throw new Error('未找到可访问的 Jira 站点，请确认授权时选择了站点');
    credential = { ...credential, cloudId: first.id };
    site = new URL(first.url!).hostname;
  }
  const raw = JSON.stringify(credential);
  const response = await call(id, credential, id === 'asana' ? '/users/me' : '/rest/api/3/myself');
  if (!response.ok) throw new Error(`无法读取 ${NAME[id]} 账户 (${response.status})`);
  const body = await response.json();
  if (id === 'jira') {
    if (typeof body?.accountId !== 'string') throw new Error('无法识别 Jira 账户');
    return { credential: raw, account: `jr-${body.accountId}@${site.split('.')[0]}`, label: `${body.emailAddress || body.displayName || ''} @ ${site}` };
  }
  return { credential: raw, ...(await personalTokenIdentity('asana', credential.accessToken, body)) };
}
function call(id: RotatingProvider, c: Credential, path: string, init?: RequestInit) {
  return callWithPersonalToken(id, c.accessToken, path, init, id === 'jira' ? { jiraCloudId: c.cloudId ?? '' } : { bearer: true });
}
export function isRotatingCredential(value: string) { return value.startsWith('{'); }

/** Plain personal tokens keep working; OAuth JSON refreshes under a CAS lease so concurrent reads never spend a rotating token twice. */
export async function callWithRotatingCredential(id: RotatingProvider, userId: string, row: { id: string; account_key: string; connection_key_ciphertext: string }, path: string, init?: RequestInit): Promise<Response> {
  let ciphertext = row.connection_key_ciphertext;
  for (let attempt = 0; attempt < 40; attempt++) {
    const raw = decryptConnectionKey(ciphertext, 'personal_token');
    if (!isRotatingCredential(raw)) return callWithPersonalToken(id, raw, path, init);
    const credential = credentialSchema.parse(JSON.parse(raw));
    if (credential.expiresAt > Date.now() + 60000 && !credential.refreshingUntil) {
      const response = await call(id, credential, path, init);
      if (response.status === 401) throw new RotatingReconnectError(id);
      return response;
    }
    if (!credential.refreshingUntil || credential.refreshingUntil < Date.now()) {
      const claimed = await replaceRotatingCredential(userId, row.id, id, ciphertext, JSON.stringify({ ...credential, refreshingUntil: Date.now() + 30000 }));
      if (claimed) {
        try {
          const next = await requestTokens(id, { grant_type: 'refresh_token', refresh_token: credential.refreshToken }, credential);
          if (!(await replaceRotatingCredential(userId, row.id, id, claimed, JSON.stringify(next)))) throw new Error(`${NAME[id]} 连接已变更，请刷新后重试`);
          const response = await call(id, next, path, init);
          if (response.status === 401) throw new RotatingReconnectError(id);
          return response;
        } catch (error) {
          await replaceRotatingCredential(userId, row.id, id, claimed, JSON.stringify(credential));
          throw error;
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    const current = await getConnection(userId, id, row.account_key);
    if (!current || current.id !== row.id || !current.enabled) throw new Error(`${NAME[id]} 连接已断开或停用`);
    ciphertext = current.connection_key_ciphertext;
  }
  throw new Error(`${NAME[id]} 授权正在更新，请稍后重试`);
}
