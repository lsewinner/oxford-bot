import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('linear one-click oauth', () => {
  beforeEach(() => {
    process.env['APP_USER_CONNECTION_KEY_SECRET'] = Buffer.alloc(32, 7).toString('base64');
    process.env['LINEAR_OAUTH_CLIENT_ID'] = 'cid';
    process.env['LINEAR_OAUTH_CLIENT_SECRET'] = 'sec';
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('binds state to the signed-in user and rejects tampering', async () => {
    const { signLinearState, verifyLinearState } = await import('@/lib/connections/linear-oauth.server');
    const state = signLinearState('user-1');
    expect(verifyLinearState(state).u).toBe('user-1');
    expect(() => verifyLinearState(state.slice(0, -2) + 'xx')).toThrow();
  });

  it('refuses to start when the client is not configured', async () => {
    delete process.env['LINEAR_OAUTH_CLIENT_ID'];
    const { buildLinearAuthUrl, signLinearState } = await import('@/lib/connections/linear-oauth.server');
    expect(() => buildLinearAuthUrl('https://oxford.bot/api/oauth/linear/callback', signLinearState('user-1'))).toThrow('尚未配置');
  });

  it('asks Linear for read plus the two create scopes and returns to Oxford Bot', async () => {
    const { buildLinearAuthUrl, signLinearState } = await import('@/lib/connections/linear-oauth.server');
    const url = new URL(buildLinearAuthUrl('https://oxford.bot/api/oauth/linear/callback', signLinearState('user-1')));
    expect(`${url.origin}${url.pathname}`).toBe('https://linear.app/oauth/authorize');
    expect(url.searchParams.get('scope')).toBe('read,write,issues:create,comments:create');
    expect(url.searchParams.get('redirect_uri')).toBe('https://oxford.bot/api/oauth/linear/callback');
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('exchanges the code as a form body and keeps the rotating refresh token', async () => {
    const seen: { url: string; body: string; type: string | null }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      seen.push({ url: String(url), body: String(init?.body ?? ''), type: (init?.headers as Record<string, string>)?.['Content-Type'] ?? null });
      return new Response(JSON.stringify({ access_token: 'acc', refresh_token: 'rotating', expires_in: 86399 }), { status: 200 });
    }));
    const { exchangeLinearCode } = await import('@/lib/connections/linear-oauth.server');
    expect(await exchangeLinearCode('c', 'https://oxford.bot/api/oauth/linear/callback')).toEqual({ accessToken: 'acc', refreshToken: 'rotating' });
    expect(seen[0]?.url).toBe('https://api.linear.app/oauth/token');
    expect(seen[0]?.type).toBe('application/x-www-form-urlencoded');
    expect(seen[0]?.body).toContain('grant_type=authorization_code');
    expect(seen[0]?.body).toContain('code=c');
    expect(seen[0]?.body).not.toContain('{');
  });

  it('surfaces the Linear token error without exposing the response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Code not found' }), { status: 400 })));
    const { exchangeLinearCode } = await import('@/lib/connections/linear-oauth.server');
    await expect(exchangeLinearCode('bad', 'https://oxford.bot/api/oauth/linear/callback')).rejects.toThrow('Code not found');
  });

  it('mints a fresh access token and stores the rotated refresh token', async () => {
    const rotated: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      if (String(url).includes('/oauth/token')) return new Response(JSON.stringify({ access_token: 'acc2', refresh_token: 'next' }), { status: 200 });
      return new Response(JSON.stringify({ data: { viewer: { id: 'u1' } } }), { status: 200 });
    }));
    const { callLinearGraphQL } = await import('@/lib/connections/linear-oauth.server');
    await callLinearGraphQL('stale', 'query { viewer { id } }', undefined, async (token) => { rotated.push(token); });
    expect(rotated).toEqual(['next']);
  });

  it('treats a dead refresh token as a reconnect instead of a hard failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })));
    const { callLinearGraphQL, LinearReconnectError } = await import('@/lib/connections/linear-oauth.server');
    await expect(callLinearGraphQL('dead', 'query { viewer { id } }')).rejects.toBeInstanceOf(LinearReconnectError);
  });

  it('keys the account by workspace so several workspaces can coexist', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { viewer: { id: 'u1', name: 'Michael' }, organization: { id: 'org-9', name: 'Oxford' } } }), { status: 200 })));
    const { getLinearAccount } = await import('@/lib/connections/linear-oauth.server');
    expect(await getLinearAccount('acc')).toEqual({ account: 'ln-org-9', label: 'Oxford · Michael' });
  });
});
