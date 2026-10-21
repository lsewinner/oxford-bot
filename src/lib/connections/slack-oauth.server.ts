import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { resolveConnectionSecret } from './connection-secret.server';

const AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const BOT_SCOPES = 'channels:read,channels:history,chat:write,users:read';

interface StatePayload { u: string; p: 'slack'; n: string; e: number }

export function slackOAuthConfigured(): boolean {
  return Boolean(process.env['SLACK_OAUTH_CLIENT_ID'] && process.env['SLACK_OAUTH_CLIENT_SECRET']);
}

function clientConfig() {
  const clientId = process.env['SLACK_OAUTH_CLIENT_ID'];
  const clientSecret = process.env['SLACK_OAUTH_CLIENT_SECRET'];
  if (!clientId || !clientSecret) throw new Error('Slack 一键授权尚未配置');
  return { clientId, clientSecret };
}

export function signSlackState(userId: string): string {
  const payload: StatePayload = { u: userId, p: 'slack', n: randomBytes(16).toString('hex'), e: Date.now() + 10 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', resolveConnectionSecret('connection')).update(`slack.${body}`).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySlackState(state: string): StatePayload {
  const [body, sig] = state.split('.');
  if (!body || !sig) throw new Error('授权状态无效');
  const expected = createHmac('sha256', resolveConnectionSecret('connection')).update(`slack.${body}`).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('授权状态校验失败');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
  if (!payload.u || payload.p !== 'slack' || payload.e < Date.now()) throw new Error('授权状态已过期，请重试');
  return payload;
}

export function buildSlackAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = clientConfig();
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: BOT_SCOPES, state });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Exchanges the code for a bot token keyed by the Slack team id, sharing the personal-token execution path. */
export async function exchangeSlackCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = clientConfig();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}` },
    body: new URLSearchParams({ code, redirect_uri: redirectUri }),
    redirect: 'manual',
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; access_token?: string; team?: { id?: string; name?: string } } | null;
  if (!res.ok || body?.ok !== true || !body.access_token) throw new Error(`Slack 授权换取失败${body?.error ? `：${body.error}` : ''}`);
  const teamId = body.team?.id;
  if (!teamId) throw new Error('Slack 未返回工作区信息，请重试');
  return { token: body.access_token, account: `slack-${teamId}`, label: typeof body.team?.name === 'string' ? body.team.name : '' };
}
