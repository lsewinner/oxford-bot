import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { encryptConnectionKey, decryptConnectionKey } from './storage.server';
import { callWithPersonalToken, personalTokenIdentity } from './personal-token.server';

export const CLICKUP_CALLBACK = '/api/public/connections/clickup/callback';
const stateSchema = z.object({ userId: z.string().uuid(), provider: z.literal('clickup'), nonce: z.string().min(16).max(64), redirectUri: z.string().url(), expires: z.number() }).strict();
type State = z.infer<typeof stateSchema>;

function config() {
  const clientId = process.env['CLICKUP_OAUTH_CLIENT_ID']?.trim();
  const clientSecret = process.env['CLICKUP_OAUTH_CLIENT_SECRET']?.trim();
  if (!clientId || !clientSecret) throw new Error('ClickUp 一键授权尚未配置');
  return { clientId, clientSecret };
}

/** ClickUp's authorize endpoint takes neither scopes nor PKCE; the app's registered redirect URL decides access. */
export function startClickUpAuthorization(userId: string, redirectUri: string) {
  const { clientId } = config();
  const payload = stateSchema.parse({ userId, provider: 'clickup', nonce: randomBytes(16).toString('base64url'), redirectUri, expires: Date.now() + 600000 });
  const state = encryptConnectionKey(JSON.stringify(payload), 'personal_token');
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, state });
  return { authorizationUrl: `https://app.clickup.com/api?${params}` };
}
export function verifyClickUpState(state: string): State {
  if (!state || state.length > 4096) throw new Error('ClickUp 授权状态无效');
  const payload = stateSchema.parse(JSON.parse(decryptConnectionKey(state, 'personal_token')));
  if (payload.expires <= Date.now()) throw new Error('ClickUp 授权已过期，请重试');
  return payload;
}
export async function exchangeClickUpCode(code: string, state: State) {
  const { clientId, clientSecret } = config();
  const response = await fetch('https://api.clickup.com/api/v2/oauth/token', {
    method: 'POST', redirect: 'manual',
    // ClickUp expects the developer credentials inside the JSON body, not in a Basic auth header.
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const body = await response.json().catch(() => null) as { access_token?: string } | null;
  if (!response.ok || typeof body?.access_token !== 'string' || !body.access_token) {
    // Never log token response bodies that may contain credentials.
    throw new Error(`ClickUp 授权失败 (${response.status})${response.status === 400 || response.status === 401 ? '：请检查开发者凭证' : ''}`);
  }
  const identity = await callWithPersonalToken('clickup', body.access_token, '/api/v2/user');
  if (!identity.ok) throw new Error(`无法读取 ClickUp 账户 (${identity.status})`);
  const who = await personalTokenIdentity('clickup', body.access_token, await identity.json());
  return { credential: body.access_token, ...who };
}
