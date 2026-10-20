export const APP_URL = 'https://oxford.bot/';

export function isAppUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === 'https://oxford.bot' && !url.username && !url.password;
  } catch { return false; }
}

export type Destination = 'app' | 'browser' | 'oauth' | 'blocked';

export function destination(value: string): Destination {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return 'blocked';
    if (/\/oauth(?:2)?(?:\/|$)|\/authorize(?:\/|$)/i.test(url.pathname)
      || url.searchParams.has('client_id')
      || ['accounts.google.com', 'login.microsoftonline.com'].includes(url.hostname)) return 'oauth';
    return isAppUrl(value) ? 'app' : 'browser';
  } catch { return 'blocked'; }
}
