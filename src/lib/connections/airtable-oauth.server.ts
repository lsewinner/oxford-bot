import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { encryptConnectionKey, decryptConnectionKey, replaceAirtableCredential, getConnection } from './storage.server';
import { callWithPersonalToken, personalTokenIdentity } from './personal-token.server';

export const AIRTABLE_CALLBACK = '/api/public/connections/airtable/callback';
export const AIRTABLE_SCOPES = ['data.records:read', 'data.records:write', 'schema.bases:read', 'user.email:read'];
const stateSchema = z.object({ userId: z.string().uuid(), provider: z.literal('airtable'), verifier: z.string().min(43).max(128), redirectUri: z.string().url(), expires: z.number() }).strict();
const credentialSchema = z.object({ provider: z.literal('airtable_oauth'), accessToken: z.string().min(1), refreshToken: z.string().min(1), expiresAt: z.number(), refreshingUntil: z.number().optional() }).strict();
type Credential = z.infer<typeof credentialSchema>;
type State = z.infer<typeof stateSchema>;
function config() {
  const clientId = process.env['AIRTABLE_OAUTH_CLIENT_ID']?.trim();
  const clientSecret = process.env['AIRTABLE_OAUTH_CLIENT_SECRET']?.trim();
  if (!clientId || !clientSecret) throw new Error('Airtable 一键授权尚未配置');
  return { clientId, clientSecret };
}
export function startAirtableAuthorization(userId: string, redirectUri: string) {
  const { clientId } = config();
  const verifier = randomBytes(32).toString('base64url');
  const payload = stateSchema.parse({ userId, provider: 'airtable', verifier, redirectUri, expires: Date.now() + 600000 });
  const state = encryptConnectionKey(JSON.stringify(payload), 'personal_token');
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: AIRTABLE_SCOPES.join(' '), state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
  return { authorizationUrl: `https://airtable.com/oauth2/v1/authorize?${params}` };
}
export function verifyAirtableState(state: string): State {
  if (!state || state.length > 4096) throw new Error('Airtable 授权状态无效');
  const payload = stateSchema.parse(JSON.parse(decryptConnectionKey(state, 'personal_token')));
  if (payload.expires <= Date.now()) throw new Error('Airtable 授权已过期，请重试');
  return payload;
}
export class AirtableReconnectError extends Error {
  constructor() { super('Airtable 授权已失效，请重新连接'); }
}
async function requestTokens(fields: Record<string, string>): Promise<Credential> {
  const { clientId, clientSecret } = config();
  const response = await fetch('https://airtable.com/oauth2/v1/token', {
    method: 'POST', redirect: 'manual',
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64url')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  });
  const body = await response.json().catch(() => null) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string } | null;
  if (!response.ok || !body?.access_token || !body.refresh_token || typeof body.expires_in !== 'number' || body.expires_in <= 0) {
    if (body?.error === 'invalid_grant' && fields['grant_type'] === 'refresh_token') throw new AirtableReconnectError();
    // Never log token response bodies or provider descriptions that may contain credentials.
    throw new Error(`Airtable 授权失败 (${response.status})${body?.error === 'invalid_client' ? '：请检查开发者凭证' : response.status === 409 ? '：授权正在更新，请稍后重试' : ''}`);
  }
  return { provider: 'airtable_oauth', accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: Date.now() + body.expires_in * 1000 };
}
export async function exchangeAirtableCode(code: string, state: State) {
  const credential = await requestTokens({ grant_type: 'authorization_code', code, redirect_uri: state.redirectUri, code_verifier: state.verifier });
  const response = await callWithPersonalToken('airtable', credential.accessToken, '/v0/meta/whoami');
  if (!response.ok) throw new Error(`无法读取 Airtable 账户 (${response.status})`);
  const identity = await personalTokenIdentity('airtable', credential.accessToken, await response.json());
  return { credential: JSON.stringify(credential), ...identity };
}
export function isAirtableOAuthCredential(value: string) { return value.startsWith('{'); }

/** OAuth credentials share the encrypted personal-token row; PAT strings remain unchanged. */
export async function callWithAirtableCredential(userId: string, row: { id: string; account_key: string; connection_key_ciphertext: string }, path: string, init?: RequestInit): Promise<Response> {
  let ciphertext = row.connection_key_ciphertext;
  for (let attempt = 0; attempt < 40; attempt++) {
    const raw = decryptConnectionKey(ciphertext, 'personal_token');
    if (!isAirtableOAuthCredential(raw)) return callWithPersonalToken('airtable', raw, path, init);
    const credential = credentialSchema.parse(JSON.parse(raw));
    if (credential.expiresAt > Date.now() + 60000 && !credential.refreshingUntil) {
      const response = await callWithPersonalToken('airtable', credential.accessToken, path, init);
      if (response.status === 401) throw new AirtableReconnectError();
      return response;
    }
    if (!credential.refreshingUntil || credential.refreshingUntil < Date.now()) {
      // Claim before the provider call; concurrent reads wait instead of spending a rotating token twice.
      const lease = JSON.stringify({ ...credential, refreshingUntil: Date.now() + 30000 });
      const claimed = await replaceAirtableCredential(userId, row.id, ciphertext, lease);
      if (claimed) {
        try {
          const next = await requestTokens({ grant_type: 'refresh_token', refresh_token: credential.refreshToken });
          const saved = await replaceAirtableCredential(userId, row.id, claimed, JSON.stringify(next));
          if (!saved) throw new Error('Airtable 连接已变更，请刷新后重试');
          const response = await callWithPersonalToken('airtable', next.accessToken, path, init);
          if (response.status === 401) throw new AirtableReconnectError();
          return response;
        } catch (error) {
          await replaceAirtableCredential(userId, row.id, claimed, JSON.stringify(credential));
          throw error;
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
    const current = await getConnection(userId, 'airtable', row.account_key);
    if (!current || current.id !== row.id || !current.enabled) throw new Error('Airtable 连接已断开或停用');
    ciphertext = current.connection_key_ciphertext;
  }
  throw new Error('Airtable 授权正在更新，请稍后重试');
}