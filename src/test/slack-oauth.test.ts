import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('slack one-click oauth', () => {
  beforeEach(() => { process.env['APP_USER_CONNECTION_KEY_SECRET'] = Buffer.alloc(32, 7).toString('base64'); process.env['SLACK_OAUTH_CLIENT_ID'] = 'cid'; process.env['SLACK_OAUTH_CLIENT_SECRET'] = 'sec'; });
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('binds state to the signed-in user and rejects tampering', async () => {
    const { signSlackState, verifySlackState } = await import('@/lib/connections/slack-oauth.server');
    const state = signSlackState('user-1');
    expect(verifySlackState(state).u).toBe('user-1');
    expect(() => verifySlackState(state.slice(0, -2) + 'xx')).toThrow();
  });

  it('refuses to start when the client is not configured', async () => {
    delete process.env['SLACK_OAUTH_CLIENT_ID'];
    const { buildSlackAuthUrl, signSlackState } = await import('@/lib/connections/slack-oauth.server');
    expect(() => buildSlackAuthUrl('https://oxford.bot/api/oauth/slack/callback', signSlackState('user-1'))).toThrow('尚未配置');
  });

  it('exchanges the code and keys the connection by Slack team id', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: { headers?: Record<string, string> }) => {
      expect(String(url)).toBe('https://slack.com/api/oauth.v2.access');
      expect(init?.headers?.Authorization?.startsWith('Basic ')).toBe(true);
      return new Response(JSON.stringify({ ok: true, access_token: 'xoxb-tok', team: { id: 'T123', name: 'Oxford HQ' } }), { status: 200 });
    }));
    const { exchangeSlackCode } = await import('@/lib/connections/slack-oauth.server');
    expect(await exchangeSlackCode('c', 'https://oxford.bot/api/oauth/slack/callback')).toEqual({ token: 'xoxb-tok', account: 'slack-T123', label: 'Oxford HQ' });
  });

  it('surfaces Slack token exchange errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'code_already_used' }), { status: 200 })));
    const { exchangeSlackCode } = await import('@/lib/connections/slack-oauth.server');
    await expect(exchangeSlackCode('bad', 'https://oxford.bot/api/oauth/slack/callback')).rejects.toThrow('code_already_used');
  });
});
