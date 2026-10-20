import assert from 'node:assert/strict';
import test from 'node:test';
import { destination, isAppUrl } from './navigation.ts';

test('only exact HTTPS application origin is embedded', () => {
  assert.ok(isAppUrl('https://oxford.bot/chat/a?x=1'));
  for (const value of ['blob:https://oxford.bot/id', 'http://oxford.bot', 'https://oxford.bot.evil.test', 'https://evil.test/oxford.bot', 'https://user@oxford.bot', 'https://oxford.bot:444', 'file:///etc/passwd', 'javascript:alert(1)']) {
    assert.equal(isAppUrl(value), false, value);
  }
});

test('sources open externally; OAuth and unsupported schemes cannot become app documents', () => {
  assert.equal(destination('https://example.com/article'), 'browser');
  assert.equal(destination('https://accounts.google.com/login'), 'oauth');
  assert.equal(destination('https://example.com/oauth/authorize'), 'oauth');
  assert.equal(destination('https://example.com/?client_id=123'), 'oauth');
  assert.equal(destination('https://oxford.bot/api/oauth/google/callback'), 'oauth');
  for (const value of ['intent://a', 'javascript:alert(1)', 'data:text/html,hello', 'blob:https://oxford.bot/x', 'https://user:pass@example.com', 'http://example.com']) {
    assert.equal(destination(value), 'blocked', value);
  }
});
