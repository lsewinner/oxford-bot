import { isAppUrl } from './navigation.ts';

// This must match app.json's scheme and the auth service's redirect allow-list.
// A fixed native URI avoids Expo Go/development URLs in store builds.
export const OAUTH_REDIRECT_URL = 'oxfordbot://oauth-callback';
const APP_ORIGIN = 'https://oxford.bot';
const MAX_CALLBACK_LENGTH = 32_768;

export type OAuthProvider = 'google' | 'apple';
export type OAuthReply =
  | { type: 'NATIVE_OAUTH_SUCCESS'; access_token: string; refresh_token: string }
  | { type: 'NATIVE_OAUTH_ERROR' };

export function parseOAuthRequest(raw: string, sourceUrl: string): { provider: OAuthProvider | null } | null {
  if (!isAppUrl(sourceUrl) || raw.length > 4_096) return null;
  try {
    const message: unknown = JSON.parse(raw);
    if (!message || typeof message !== 'object' || !('type' in message) || message.type !== 'NATIVE_OAUTH') return null;
    const provider = 'provider' in message ? message.provider : null;
    return { provider: provider === 'google' || provider === 'apple' ? provider : null };
  } catch { return null; }
}

export function oauthAuthorizeUrl(provider: OAuthProvider): string {
  const url = new URL('/api/public/sb/auth/v1/authorize', APP_ORIGIN);
  url.searchParams.set('provider', provider);
  url.searchParams.set('redirect_to', OAUTH_REDIRECT_URL);
  return url.href;
}

export function parseOAuthCallback(value: string): OAuthReply {
  const failure: OAuthReply = { type: 'NATIVE_OAUTH_ERROR' };
  if (value.length > MAX_CALLBACK_LENGTH) return failure;
  try {
    const url = new URL(value);
    if (url.protocol !== 'oxfordbot:' || url.hostname !== 'oauth-callback'
      || url.username || url.password || url.port || !['', '/'].includes(url.pathname)) return failure;
    const hash = new URLSearchParams(url.hash.slice(1));
    if (['error', 'error_code', 'error_description'].some(key => hash.has(key) || url.searchParams.has(key))) return failure;
    // The requested Supabase implicit flow returns both tokens in the fragment.
    // Never mistake a PKCE code, a website fallback or a partial session for success.
    if (hash.getAll('access_token').length !== 1 || hash.getAll('refresh_token').length !== 1) return failure;
    const access_token = hash.get('access_token');
    const refresh_token = hash.get('refresh_token');
    if (!access_token?.trim() || !refresh_token?.trim()) return failure;
    return { type: 'NATIVE_OAUTH_SUCCESS', access_token, refresh_token };
  } catch { return failure; }
}

export function oauthReplyScript(message: OAuthReply, pageUrl: string): string {
  if (!isAppUrl(pageUrl)) return 'true;';
  const json = (value: unknown) => JSON.stringify(value)
    .replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  // Re-check the live document: a system auth window may outlive a navigation.
  // Targeting this origin delivers the same window message without broadcasting tokens.
  return `(function () {
    if (window.top === window && window.location.origin === ${json(APP_ORIGIN)}
      && window.location.href === ${json(pageUrl)}) {
      window.postMessage(${json(message)}, ${json(APP_ORIGIN)});
    }
  })(); true;`;
}

type AuthResult = { type: string; url?: string };

export async function completeOAuth(
  provider: OAuthProvider,
  openSession: (url: string, redirectUrl: string) => Promise<AuthResult>,
): Promise<OAuthReply> {
  try {
    const result = await openSession(oauthAuthorizeUrl(provider), OAUTH_REDIRECT_URL);
    return result.type === 'success' && result.url
      ? parseOAuthCallback(result.url)
      : { type: 'NATIVE_OAUTH_ERROR' };
  } catch {
    // Do not log callback URLs, tokens or provider error payloads.
    return { type: 'NATIVE_OAUTH_ERROR' };
  }
}
