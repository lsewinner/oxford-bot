import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  OAUTH_REDIRECT_URL, completeOAuth, oauthAuthorizeUrl,
  oauthReplyScript, parseOAuthCallback, parseOAuthRequest,
} from './oauth.ts';

const failure = { type: 'NATIVE_OAUTH_ERROR' as const };
const tokens = { type: 'NATIVE_OAUTH_SUCCESS' as const, access_token: 'test-access', refresh_token: 'test-refresh' };
const callback = `${OAUTH_REDIRECT_URL}#access_token=test-access&refresh_token=test-refresh`;
const request = JSON.stringify({ type: 'NATIVE_OAUTH', provider: 'google' });

test('only requests from the exact app origin can launch native authentication', () => {
  assert.deepEqual(parseOAuthRequest(request, 'https://oxford.bot/auth'), { provider: 'google' });
  assert.deepEqual(parseOAuthRequest(request.replace('google', 'apple'), 'https://oxford.bot/'), { provider: 'apple' });
  for (const origin of ['https://evil.com/', 'https://oxford.bot.evil.com/', 'http://oxford.bot/',
    'https://oxford.bot:444/', 'https://user@oxford.bot/', 'data:text/html,hello']) {
    assert.equal(parseOAuthRequest(request, origin), null);
  }
});

test('malformed and download messages stay out of OAuth; unsupported providers receive an error path', () => {
  for (const raw of ['null', '[]', '{', '{}', 'x'.repeat(4097), JSON.stringify({ type: 'oxford-download' })]) {
    assert.equal(parseOAuthRequest(raw, 'https://oxford.bot/'), null);
  }
  for (const provider of ['https://evil.com', 'google&redirect_to=https://evil.com', {}, null, 1]) {
    assert.deepEqual(parseOAuthRequest(JSON.stringify({ type: 'NATIVE_OAUTH', provider }), 'https://oxford.bot/'), { provider: null });
  }
});

test('authentication opens the fixed Oxford Bot auth endpoint and native callback', async () => {
  const calls: string[][] = [];
  const result = await completeOAuth('google', async (url, redirect) => {
    calls.push([url, redirect]);
    return { type: 'success', url: callback };
  });
  assert.deepEqual(result, tokens);
  assert.equal(calls.length, 1);
  const url = new URL(calls[0][0]);
  assert.equal(url.origin, 'https://oxford.bot');
  assert.equal(url.pathname, '/api/public/sb/auth/v1/authorize');
  assert.equal(url.searchParams.get('provider'), 'google');
  assert.equal(url.searchParams.get('redirect_to'), OAUTH_REDIRECT_URL);
  assert.equal(calls[0][1], OAUTH_REDIRECT_URL);
  assert.equal(new URL(oauthAuthorizeUrl('apple')).searchParams.get('provider'), 'apple');
});

test('both tokens are decoded only from the expected callback fragment', () => {
  assert.deepEqual(parseOAuthCallback(callback), tokens);
  assert.deepEqual(parseOAuthCallback(`${OAUTH_REDIRECT_URL}/#access_token=abc%2Bdef&refresh_token=x%2Fy`), {
    type: 'NATIVE_OAUTH_SUCCESS', access_token: 'abc+def', refresh_token: 'x/y',
  });
});

test('wrong destinations, partial sessions, errors, duplicates and PKCE codes are not success', () => {
  for (const url of [
    callback.replace('oxfordbot:', 'https:'), callback.replace('oauth-callback', 'evil'),
    callback.replace('oauth-callback', 'oauth-callback.evil.com'), callback.replace('oauth-callback', 'user@oauth-callback'),
    callback.replace('oauth-callback', 'oauth-callback:123'), callback.replace('oauth-callback', 'oauth-callback/extra'),
    `${OAUTH_REDIRECT_URL}#access_token=a`, `${OAUTH_REDIRECT_URL}#access_token=a&refresh_token=`,
    `${OAUTH_REDIRECT_URL}#access_token=%20&refresh_token=r`, `${callback}&access_token=another`,
    `${callback}&refresh_token=another`, `${callback}&error=access_denied`,
    `${OAUTH_REDIRECT_URL}?error=access_denied#access_token=a&refresh_token=r`,
    `${OAUTH_REDIRECT_URL}?code=pkce-code`, `${OAUTH_REDIRECT_URL}?access_token=a&refresh_token=r`,
    `https://oxford.bot/#access_token=a&refresh_token=r`, 'not a URL', callback + 'a'.repeat(32768),
  ]) assert.deepEqual(parseOAuthCallback(url), failure, url.slice(0, 90));
});

test('cancel, dismiss, browser failure and incomplete success all notify the web page to retry', async () => {
  for (const result of [{ type: 'cancel' }, { type: 'dismiss' }, { type: 'success' },
    { type: 'success', url: `${OAUTH_REDIRECT_URL}#error=access_denied` }]) {
    assert.deepEqual(await completeOAuth('google', async () => result), failure);
  }
  assert.deepEqual(await completeOAuth('google', async () => { throw new Error('OS browser unavailable'); }), failure);
});

function runReply(script: string, href = 'https://oxford.bot/auth', topLevel = true) {
  const messages: Array<{ data: unknown; origin: string }> = [];
  const page: Record<string, unknown> = {
    location: { origin: new URL(href).origin, href },
    postMessage: (data: unknown, origin: string) => messages.push({ data: JSON.parse(JSON.stringify(data)), origin }),
  };
  page.top = topLevel ? page : {};
  vm.runInNewContext(script, { window: page });
  return messages;
}

test('success and error use the exact web message contract and an explicit target origin', () => {
  for (const message of [tokens, failure] as const) {
    const replies = runReply(oauthReplyScript(message, 'https://oxford.bot/auth'));
    assert.deepEqual(replies, [{ data: message, origin: 'https://oxford.bot' }]);
  }
});

test('tokens never reach a foreign origin, a navigated page or an iframe', () => {
  const script = oauthReplyScript(tokens, 'https://oxford.bot/auth');
  for (const url of ['https://evil.com/auth', 'https://oxford.bot/chat', 'https://oxford.bot/auth?changed=1']) {
    assert.deepEqual(runReply(script, url), []);
  }
  assert.deepEqual(runReply(script, 'https://oxford.bot/auth', false), []);
  assert.deepEqual(runReply(oauthReplyScript(tokens, 'https://evil.com/auth')), []);
});

test('token characters remain data and cannot execute injected JavaScript', () => {
  const message = { ...tokens, access_token: '\"}); window.compromised = true; //</script>\u2028\u2029' };
  assert.deepEqual(runReply(oauthReplyScript(message, 'https://oxford.bot/auth')), [{ data: message, origin: 'https://oxford.bot' }]);
});
