import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('google oauth direct flow', () => {
 beforeEach(() => { process.env['APP_USER_CONNECTION_KEY_SECRET'] = Buffer.alloc(32, 7).toString('base64'); process.env['GOOGLE_OAUTH_CLIENT_ID'] = 'test-id.apps.googleusercontent.com'; process.env['GOOGLE_OAUTH_CLIENT_SECRET'] = 'test-secret'; });
 afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

 it('signs and verifies state bound to user and provider', async () => {
  const { signState, verifyState } = await import('@/lib/connections/google-oauth.server');
  const state = signState('user-1', 'google_mail');
  expect(verifyState(state)).toMatchObject({ u: 'user-1', p: 'google_mail' });
 });

 it('rejects tampered state', async () => {
  const { signState, verifyState } = await import('@/lib/connections/google-oauth.server');
  const state = signState('user-1', 'google_mail');
  await expect(async () => verifyState(state.slice(0, -2) + 'xx')).rejects.toThrow();
  const other = signState('user-2', 'google_drive');
  expect(verifyState(other).u).toBe('user-2');
 });

 it('builds an offline consent url with the provider scopes and callback', async () => {
  const { buildGoogleAuthUrl } = await import('@/lib/connections/google-oauth.server');
  const url = new URL(buildGoogleAuthUrl('google_drive', 'https://app.example/api/oauth/google/callback', 'state-1'));
  expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
  expect(url.searchParams.get('redirect_uri')).toBe('https://app.example/api/oauth/google/callback');
  expect(url.searchParams.get('access_type')).toBe('offline');
  expect(url.searchParams.get('scope')).toContain('drive.readonly');
  expect(url.searchParams.get('state')).toBe('state-1');
 });

 it('exchanges the code for a refresh token and refuses without one', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ refresh_token: 'rt-1', access_token: 'at-1' }));
  vi.stubGlobal('fetch', fetcher);
  const { exchangeGoogleCode } = await import('@/lib/connections/google-oauth.server');
  await expect(exchangeGoogleCode('code-1', 'https://app.example/cb')).resolves.toBe('rt-1');
  fetcher.mockResolvedValueOnce(Response.json({ access_token: 'at-only' }));
  await expect(exchangeGoogleCode('code-2', 'https://app.example/cb')).rejects.toThrow();
 });

 it('calls google apis on fixed hosts with a refreshed access token', async () => {
  const fetcher = vi.fn()
   .mockResolvedValueOnce(Response.json({ access_token: 'at-1' }))
   .mockResolvedValueOnce(Response.json({ emailAddress: 'me@example.com' }));
  vi.stubGlobal('fetch', fetcher);
  const { callWithGoogleToken } = await import('@/lib/connections/google-oauth.server');
  const res = await callWithGoogleToken('google_mail', 'rt-1', '/gmail/v1/users/me/profile');
  expect(res.ok).toBe(true);
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://oauth2.googleapis.com/token');
  expect(fetcher.mock.calls[1]?.[0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/profile');
  expect((fetcher.mock.calls[1]?.[1] as RequestInit).redirect).toBe('manual');
 });

 it('rejects arbitrary paths before sending credentials', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const { callWithGoogleToken } = await import('@/lib/connections/google-oauth.server');
  await expect(callWithGoogleToken('google_mail', 'rt-1', 'https://evil.example/x')).rejects.toThrow('不支持');
  expect(fetcher).not.toHaveBeenCalled();
 });

 it('maps invalid_grant to a reconnect signal', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'invalid_grant' }, { status: 400 })));
  const { getGoogleAccessToken, GoogleReconnectError } = await import('@/lib/connections/google-oauth.server');
  await expect(getGoogleAccessToken('rt-dead')).rejects.toBeInstanceOf(GoogleReconnectError);
 });
});
