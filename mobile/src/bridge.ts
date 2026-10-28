/** A narrow, one-way download bridge. Never accepts URLs, scripts, or auth data. */
export const DOWNLOAD_ORIGIN = 'https://oxford.bot';
export const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;
const MAX_BASE64_LENGTH = 4 * Math.ceil(MAX_DOWNLOAD_BYTES / 3);

const EXTENSIONS = {
  'text/plain': 'txt',
  'text/markdown': 'md',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

export type DownloadMimeType = keyof typeof EXTENSIONS;
export type DownloadBridgeMessage =
  | {
      type: 'oxford-download';
      version: 1;
      filename: string;
      mimeType: DownloadMimeType;
      dataBase64: string;
    }
  | {
      type: 'oxford-download-unavailable';
      version: 1;
      reason: 'unsupported-type' | 'too-large' | 'unavailable';
    };

export function isDownloadOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.origin === DOWNLOAD_ORIGIN && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

export function sanitizeDownloadFilename(name: string, mimeType: DownloadMimeType): string {
  // Strip directory components and control / bidi characters before native file creation.
  let stem = (name.split(/[\\/]/).pop() || 'Oxford-Bot')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069<>:"|?*]/g, '_')
    .replace(/^\.+/, '')
    .replace(/\.[^.]*$/, '')
    .replace(/[.\s]+$/g, '')
    .trim()
    .slice(0, 80);
  if (!stem || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) stem = 'Oxford-Bot';
  return `${stem}.${EXTENSIONS[mimeType]}`;
}

/** Pass event.nativeEvent.url, never an origin supplied inside the message payload. */
export function parseDownloadMessage(raw: string, sourceUrl: string): DownloadBridgeMessage | null {
  if (!isDownloadOrigin(sourceUrl) || typeof raw !== 'string' || raw.length > MAX_BASE64_LENGTH + 1024) return null;
  let value: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    value = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  if (value.version !== 1) return null;
  if (value.type === 'oxford-download-unavailable') {
    if (Object.keys(value).length !== 3 || typeof value.reason !== 'string' || !['unsupported-type', 'too-large', 'unavailable'].includes(value.reason)) return null;
    return value as DownloadBridgeMessage;
  }
  if (
    value.type !== 'oxford-download' || Object.keys(value).length !== 5 ||
    typeof value.filename !== 'string' || value.filename.length > 256 ||
    typeof value.mimeType !== 'string' || !Object.prototype.hasOwnProperty.call(EXTENSIONS, value.mimeType) ||
    typeof value.dataBase64 !== 'string' || !value.dataBase64.length ||
    value.dataBase64.length > MAX_BASE64_LENGTH ||
    value.dataBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.dataBase64)
  ) return null;
  const padding = value.dataBase64.endsWith('==') ? 2 : value.dataBase64.endsWith('=') ? 1 : 0;
  const bytes = value.dataBase64.length / 4 * 3 - padding;
  if (bytes > MAX_DOWNLOAD_BYTES) return null;
  const mimeType = value.mimeType as DownloadMimeType;
  return {
    type: 'oxford-download',
    version: 1,
    filename: sanitizeDownloadFilename(value.filename, mimeType),
    mimeType,
    dataBase64: value.dataBase64,
  };
}

/**
 * Run only in the main Oxford.bot WebView. Intercepts explicit blob/data download
 * anchors, including detached programmatic a.click() used by conversation exports.
 * HTTP(S) links, normal navigation, other frames, and other sites are untouched.
 */
export const DOWNLOAD_BRIDGE_SCRIPT = `
(function () {
  if (location.origin !== ${JSON.stringify(DOWNLOAD_ORIGIN)} || window.top !== window ||
      !window.ReactNativeWebView || window.__oxfordDownloadBridgeInstalled) return true;
  window.__oxfordDownloadBridgeInstalled = true;
  var maxBytes = ${MAX_DOWNLOAD_BYTES};
  var maxBase64 = ${MAX_BASE64_LENGTH};
  var allowedTypes = ${JSON.stringify(Object.keys(EXTENSIONS))};
  var busy = false;
  function send(payload) { window.ReactNativeWebView.postMessage(JSON.stringify(payload)); }
  function unavailable(reason) { send({ type: 'oxford-download-unavailable', version: 1, reason: reason }); }
  function validateAndSend(filename, mimeType, dataBase64) {
    if (allowedTypes.indexOf(mimeType) < 0) { unavailable('unsupported-type'); return; }
    if (dataBase64.length > maxBase64) { unavailable('too-large'); return; }
    if (!dataBase64.length || dataBase64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) {
      unavailable('unavailable'); return;
    }
    var padding = dataBase64.endsWith('==') ? 2 : dataBase64.endsWith('=') ? 1 : 0;
    if (dataBase64.length / 4 * 3 - padding > maxBytes) { unavailable('too-large'); return; }
    send({ type: 'oxford-download', version: 1, filename: filename.slice(0, 256), mimeType: mimeType, dataBase64: dataBase64 });
  }
  function transfer(href, filename) {
    if (busy) { unavailable('unavailable'); return; }
    busy = true;
    // Start immediately: a caller may revoke its object URL as soon as click()
    // returns. An async IIFE reaches fetch() before its first await yields.
    (async function () {
      if (href.startsWith('data:')) {
        if (href.length > maxBase64 + 128) { unavailable('too-large'); return; }
        var comma = href.indexOf(',');
        var header = href.slice(0, comma).toLowerCase();
        var match = /^data:(text\\/plain|text\\/markdown|image\\/png|image\\/jpeg|image\\/webp)(?:;charset=utf-8)?;base64$/.exec(header);
        if (comma < 0 || !match) { unavailable('unsupported-type'); return; }
        validateAndSend(filename, match[1], href.slice(comma + 1));
        return;
      }
      // A blob URL is resolved inside its creating page; never ask native code to fetch it.
      if (!href.startsWith('blob:') || new URL(href).origin !== location.origin) { unavailable('unavailable'); return; }
      var response = await fetch(href);
      if (!response.ok) { unavailable('unavailable'); return; }
      var blob = await response.blob();
      if (blob.size > maxBytes) { unavailable('too-large'); return; }
      var mimeType = blob.type.split(';')[0].toLowerCase();
      if (allowedTypes.indexOf(mimeType) < 0) { unavailable('unsupported-type'); return; }
      var dataUrl = await new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(reader.result); };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (typeof dataUrl !== 'string') { unavailable('unavailable'); return; }
      validateAndSend(filename, mimeType, dataUrl.slice(dataUrl.indexOf(',') + 1));
    })().catch(function () { unavailable('unavailable'); }).finally(function () { busy = false; });
  }
  function intercept(anchor) {
    if (!(anchor instanceof HTMLAnchorElement) || !anchor.hasAttribute('download')) return false;
    var href = anchor.href;
    if (!href.startsWith('blob:') && !href.startsWith('data:')) return false;
    transfer(href, anchor.download || 'Oxford-Bot');
    return true;
  }
  var originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (!intercept(this)) return originalClick.call(this);
  };
  document.addEventListener('click', function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest('a[download]') : null;
    if (intercept(anchor)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  return true;
})(); true;
`;
