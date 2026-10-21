import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('github one-click oauth', () => {
  beforeEach(() => { process.env['APP_USER_CONNECTION_KEY_SECRET'] = Buffer.alloc(32, 7).toString('base64'); process.env['GITHUB_OAUTH_CLIENT_ID'] = 'cid'; process.env['GITHUB_OAUTH_CLIENT_SECRET'] = 'sec'; });
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('binds state to the signed-in user and rejects tampering', async () => {
    const { signGithubState, verifyGithubState } = await import('@/lib/connections/github-oauth.server');
    const state = signGithubState('user-1');
    expect(verifyGithubState(state).u).toBe('user-1');
    expect(() => verifyGithubState(state.slice(0, -2) + 'xx')).toThrow();
  });

  it('refuses to start when the client is not configured', async () => {
    delete process.env['GITHUB_OAUTH_CLIENT_ID'];
    const { buildGithubAuthUrl, signGithubState } = await import('@/lib/connections/github-oauth.server');
    expect(() => buildGithubAuthUrl('https://oxford.bot/api/oauth/github/callback', signGithubState('user-1'))).toThrow('尚未配置');
  });

  it('exchanges the code and keys the connection by GitHub user id', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      if (String(url).includes('api.github.com')) return new Response(JSON.stringify({ id: 42, login: 'michael' }), { status: 200 });
      return new Response(JSON.stringify({ access_token: 'gho_tok' }), { status: 200 });
    }));
    const { exchangeGithubCode } = await import('@/lib/connections/github-oauth.server');
    expect(await exchangeGithubCode('c', 'https://oxford.bot/api/oauth/github/callback')).toEqual({ token: 'gho_tok', account: 'gh-42', label: 'michael' });
  });

  it('surfaces GitHub token exchange errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'bad_verification_code', error_description: 'The code passed is incorrect.' }), { status: 400 })));
    const { exchangeGithubCode } = await import('@/lib/connections/github-oauth.server');
    await expect(exchangeGithubCode('bad', 'https://oxford.bot/api/oauth/github/callback')).rejects.toThrow('bad_verification_code');
  });
});
