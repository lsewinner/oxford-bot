import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  DOWNLOAD_BRIDGE_SCRIPT,
  MAX_DOWNLOAD_BYTES,
  isDownloadOrigin,
  parseDownloadMessage,
  sanitizeDownloadFilename,
} from './bridge.ts';

const payload = (overrides: Record<string, unknown> = {}) => JSON.stringify({
  type: 'oxford-download', version: 1, filename: 'Oxford-Bot.md',
  mimeType: 'text/markdown', dataBase64: Buffer.from('# Hello 世界').toString('base64'),
  ...overrides,
});

test('only the exact HTTPS Oxford.bot origin can invoke a download', () => {
  assert.ok(isDownloadOrigin('https://oxford.bot/chat/123'));
  for (const url of ['https://oxford.bot.attacker.com/', 'https://www.oxford.bot/', 'http://oxford.bot/',
    'https://oxford.bot:444/', 'https://user:pass@oxford.bot/', 'blob:https://oxford.bot/id',
    'data:text/plain,test', 'javascript:alert(1)', 'https://evil.com/?origin=https://oxford.bot']) {
    assert.equal(parseDownloadMessage(payload(), url), null, url);
  }
});

test('valid bounded content gets a safe basename and MIME-derived extension', () => {
  const result = parseDownloadMessage(payload({ filename: '../../report.exe' }), 'https://oxford.bot/');
  assert.equal(result?.type, 'oxford-download');
  if (result?.type !== 'oxford-download') throw new Error('Missing parsed download');
  assert.equal(result.filename, 'report.md');
  assert.equal(Buffer.from(result.dataBase64, 'base64').toString(), '# Hello 世界');
  assert.equal(sanitizeDownloadFilename('C:\\tmp\\你好\u202e.png', 'text/plain'), '你好_.txt');
  assert.equal(sanitizeDownloadFilename('..', 'image/png'), 'Oxford-Bot.png');
  assert.equal(sanitizeDownloadFilename('CON.exe', 'image/webp'), 'Oxford-Bot.webp');
});

test('malformed, executable, URL and arbitrary bridge messages are rejected', () => {
  for (const raw of ['not JSON', 'null', '[]', payload({ version: 2 }), payload({ type: 'evaluate' }),
    payload({ mimeType: 'text/html' }), payload({ mimeType: '__proto__' }), payload({ filename: 123 }),
    payload({ dataBase64: 'https://evil.com/file' }), payload({ dataBase64: '' }),
    payload({ dataBase64: 'YWJj\n' }), payload({ dataBase64: 'A===' }),
    payload({ url: 'https://evil.com' }), payload({ javascript: 'alert(1)' })]) {
    assert.equal(parseDownloadMessage(raw, 'https://oxford.bot/'), null);
  }
});

test('byte boundary is enforced including base64 padding', () => {
  const exact = Buffer.alloc(MAX_DOWNLOAD_BYTES).toString('base64');
  assert.equal(parseDownloadMessage(payload({ dataBase64: exact }), 'https://oxford.bot/')?.type, 'oxford-download');
  const oversized = Buffer.alloc(MAX_DOWNLOAD_BYTES + 1).toString('base64');
  assert.equal(parseDownloadMessage(payload({ dataBase64: oversized }), 'https://oxford.bot/'), null);
});

test('unavailable notifications use only fixed reasons', () => {
  const notice = { type: 'oxford-download-unavailable', version: 1, reason: 'too-large' };
  assert.deepEqual(parseDownloadMessage(JSON.stringify(notice), 'https://oxford.bot/'), notice);
  assert.equal(parseDownloadMessage(JSON.stringify({ ...notice, reason: '<script>' }), 'https://oxford.bot/'), null);
  assert.equal(parseDownloadMessage(JSON.stringify({ ...notice, url: 'https://evil.com' }), 'https://oxford.bot/'), null);
});

function createPage(origin = 'https://oxford.bot', resolvedBlob?: Blob, isBlobAvailable = () => true) {
  const messages: string[] = [];
  const fetched: string[] = [];
  let originalClicks = 0;
  class Anchor {
    href: string;
    download: string;
    constructor(href: string, download = 'Oxford-Bot.txt') { this.href = href; this.download = download; }
    hasAttribute(attribute: string) { return attribute === 'download'; }
    click() { originalClicks++; }
  }
  class Reader {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: ((error: unknown) => void) | null = null;
    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then(buffer => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
        this.onload?.();
      }).catch(error => this.onerror?.(error));
    }
  }
  const page: Record<string, unknown> = {
    ReactNativeWebView: { postMessage: (message: string) => messages.push(message) },
  };
  page.top = page;
  vm.runInNewContext(DOWNLOAD_BRIDGE_SCRIPT, {
    window: page,
    location: { origin },
    HTMLAnchorElement: Anchor,
    FileReader: Reader,
    document: { addEventListener() {} },
    URL,
    fetch: async (url: string) => {
      fetched.push(url);
      if (!isBlobAvailable()) throw new Error('Blob URL was revoked');
      if (resolvedBlob) return { ok: true, blob: async () => resolvedBlob };
      throw new Error('Test fetch unavailable');
    },
  });
  return { Anchor, messages, fetched, clicks: () => originalClicks };
}

test('detached programmatic anchors transfer only explicit base64 download content', async () => {
  const page = createPage();
  new page.Anchor('data:text/plain;charset=utf-8;base64,SGVsbG8=').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.clicks(), 0);
  assert.equal(page.fetched.length, 0);
  const result = parseDownloadMessage(page.messages[0], 'https://oxford.bot/');
  assert.equal(result?.type, 'oxford-download');
  if (result?.type === 'oxford-download') assert.equal(result.dataBase64, 'SGVsbG8=');
});

test('same-origin blob export is resolved in the page and sent as bounded bytes', async () => {
  const page = createPage('https://oxford.bot', new Blob(['# Export 世界'], { type: 'text/markdown;charset=utf-8' }));
  new page.Anchor('blob:https://oxford.bot/local-id', 'Report.md').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(page.fetched, ['blob:https://oxford.bot/local-id']);
  const result = parseDownloadMessage(page.messages[0], 'https://oxford.bot/chat/123');
  assert.equal(result?.type, 'oxford-download');
  if (result?.type === 'oxford-download') {
    assert.equal(result.filename, 'Report.md');
    assert.equal(Buffer.from(result.dataBase64, 'base64').toString(), '# Export 世界');
    assert.equal('url' in result, false);
  }
});

test('blob fetch begins before a.click returns even when the caller immediately revokes the URL', async () => {
  let revoked = false;
  const page = createPage(
    'https://oxford.bot',
    new Blob(['Immediate export'], { type: 'text/plain;charset=utf-8' }),
    () => !revoked,
  );
  new page.Anchor('blob:https://oxford.bot/immediate-revoke', 'Report.txt').click();
  // Model URL.revokeObjectURL immediately after a detached anchor.click(), before
  // promises/microtasks run. Resolving the blob must already have started.
  revoked = true;
  assert.deepEqual(page.fetched, ['blob:https://oxford.bot/immediate-revoke']);
  await new Promise(resolve => setImmediate(resolve));
  const result = parseDownloadMessage(page.messages[0], 'https://oxford.bot/');
  assert.equal(result?.type, 'oxford-download');
  if (result?.type === 'oxford-download') {
    assert.equal(Buffer.from(result.dataBase64, 'base64').toString(), 'Immediate export');
  }
});

test('oversized blobs are reported unavailable before sending data to native', async () => {
  const page = createPage('https://oxford.bot', new Blob([Buffer.alloc(MAX_DOWNLOAD_BYTES + 1)], { type: 'image/png' }));
  new page.Anchor('blob:https://oxford.bot/local-id').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(parseDownloadMessage(page.messages[0], 'https://oxford.bot/'), {
    type: 'oxford-download-unavailable', version: 1, reason: 'too-large',
  });
});

test('injection is inactive on another origin and leaves normal HTTPS links alone', () => {
  const foreign = createPage('https://evil.com');
  new foreign.Anchor('data:text/plain;base64,SGVsbG8=').click();
  assert.equal(foreign.clicks(), 1);
  assert.deepEqual(foreign.messages, []);
  const trusted = createPage();
  new trusted.Anchor('https://example.com/file').click();
  assert.equal(trusted.clicks(), 1);
  assert.deepEqual(trusted.messages, []);
});

test('foreign blob URLs and unsupported content are never fetched or reported successful', async () => {
  for (const href of ['blob:https://evil.com/id', 'data:text/html;base64,SGVsbG8=', 'data:text/plain,Hello']) {
    const page = createPage();
    new page.Anchor(href).click();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(page.fetched, []);
    assert.equal(parseDownloadMessage(page.messages[0], 'https://oxford.bot/')?.type, 'oxford-download-unavailable');
  }
});
