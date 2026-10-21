import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('notion one-click oauth', () => {
  beforeEach(() => { process.env['APP_USER_CONNECTION_KEY_SECRET'] = Buffer.alloc(32, 7).toString('base64'); process.env['NOTION_OAUTH_CLIENT_ID'] = 'cid'; process.env['NOTION_OAUTH_CLIENT_SECRET'] = 'sec'; });
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('binds state to the signed-in user and rejects tampering', async () => {
    const { signNotionState, verifyNotionState } = await import('@/lib/connections/notion-oauth.server');
    const state = signNotionState('user-1');
    expect(verifyNotionState(state).u).toBe('user-1');
    expect(() => verifyNotionState(state.slice(0, -2) + 'xx')).toThrow();
  });

  it('keys each connection by Notion workspace', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ access_token: 'tok', workspace_id: 'ws1', workspace_name: 'Acme' }), { status: 200 })));
    const { exchangeNotionCode } = await import('@/lib/connections/notion-oauth.server');
    expect(await exchangeNotionCode('c', 'https://oxford.bot/api/oauth/notion/callback')).toEqual({ token: 'tok', account: 'nt-ws-ws1', label: 'Acme' });
  });
});
