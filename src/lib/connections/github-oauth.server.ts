import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { resolveConnectionSecret } from './connection-secret.server';

const AUTH_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';

interface StatePayload { u: string; p: 'github'; n: string; e: number }

export function githubOAuthConfigured(): boolean {
  return Boolean(process.env['GITHUB_OAUTH_CLIENT_ID'] && process.env['GITHUB_OAUTH_CLIENT_SECRET']);
}

function clientConfig() {
  const clientId = process.env['GITHUB_OAUTH_CLIENT_ID'];
  const clientSecret = process.env['GITHUB_OAUTH_CLIENT_SECRET'];
  if (!clientId || !clientSecret) throw new Error('GitHub 一键授权尚未配置');
  return { clientId, clientSecret };
}

export function signGithubState(userId: string): string {
  const payload: StatePayload = { u: userId, p: 'github', n: randomBytes(16).toString('hex'), e: Date.now() + 10 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', resolveConnectionSecret('connection')).update(`github.${body}`).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyGithubState(state: string): StatePayload {
  const [body, sig] = state.split('.');
  if (!body || !sig) throw new Error('授权状态无效');
  const expected = createHmac('sha256', resolveConnectionSecret('connection')).update(`github.${body}`).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('授权状态校验失败');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
  if (!payload.u || payload.p !== 'github' || payload.e < Date.now()) throw new Error('授权状态已过期，请重试');
  return payload;
}

export function buildGithubAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = clientConfig();
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: 'repo read:user', state, allow_signup: 'true' });
  return `${AUTH_URL}?${params.toString()}`;
}

/** Exchanges the code for an OAuth token keyed by the GitHub user id, sharing the personal-token execution path. */
export async function exchangeGithubCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = clientConfig();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    redirect: 'manual',
  });
  const body = (await res.json().catch(() => null)) as { access_token?: string; error?: string; error_description?: string } | null;
  if (!res.ok || !body?.access_token) throw new Error(`GitHub 授权换取失败${body?.error ? `：${body.error_description ?? body.error}` : ''}`);
  const user = await fetch(USER_URL, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${body.access_token}`, 'X-GitHub-Api-Version': '2022-11-28', User-Agent: 'Oxford-Bot' },
  });
  const profile = (await user.json().catch(() => null)) as { id?: number | string; login?: string } | null;
  if (!user.ok || !profile?.id) throw new Error('无法获取 GitHub 账户信息，请重试');
  return { token: body.access_token, account: `gh-${profile.id}`, label: typeof profile.login === 'string' ? profile.login : '' };
}
