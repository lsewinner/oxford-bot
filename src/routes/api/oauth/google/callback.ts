import { createFileRoute } from '@tanstack/react-router';

function html(success: boolean, connectorId: string, message: string): Response {
  const result = { type: success ? 'appUserConnectorOAuthComplete' : 'appUserConnectorOAuthFailed', connectorId, code: null };
  const safe = JSON.stringify(result).replace(/</g, '\\u003c');
  return new Response(
    `<!doctype html><html lang="zh"><head><title>Google 授权 · Oxford Bot</title></head><body><p>${message}</p><script>history.replaceState(null,'',location.pathname);if(window.opener){window.opener.postMessage(${safe},location.origin);window.close();}</script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'" } },
  );
}

export const Route = createFileRoute('/api/oauth/google/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const error = url.searchParams.get('error');
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state') ?? '';
        try {
          if (error) throw new Error('授权被取消');
          if (!code) throw new Error('授权缺少代码');
          const { verifyState, exchangeGoogleCode, getGoogleAccountEmail } = await import('@/lib/connections/google-oauth.server');
          const payload = verifyState(state);
          const redirectUri = new URL('/api/oauth/google/callback', url.origin).toString();
          const refreshToken = await exchangeGoogleCode(code, redirectUri);
          const { saveConnection } = await import('@/lib/connections/storage.server');
          const email = await getGoogleAccountEmail(refreshToken);
          await saveConnection(payload.u, payload.p, refreshToken, 'google_oauth', email);
          return html(true, payload.p, '授权成功，正在保存连接…');
        } catch (e) {
          console.error('Google OAuth callback failed:', e instanceof Error ? e.message : e);
          return html(false, 'google_mail', '授权未完成，请返回重试');
        }
      },
    },
  },
});
