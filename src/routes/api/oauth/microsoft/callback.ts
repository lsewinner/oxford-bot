import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/oauth/microsoft/callback')({
  server: { handlers: { GET: async ({ request }) => {
    const url = new URL(request.url);
    let result: { type: string; connectorId: string; code: string | null } = { type: 'appUserConnectorOAuthFailed', connectorId: 'microsoft_outlook', code: null };
    try {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (url.searchParams.has('error') || !code || code.length > 8192 || !state) throw new Error('授权未完成');
      const { verifyMicrosoftState } = await import('@/lib/connections/microsoft-oauth.server');
      const payload = verifyMicrosoftState(state);
      result.connectorId = payload.provider;
      if (new URL(payload.redirectUri).origin !== url.origin) throw new Error('授权地址不匹配');
      // Only the opener has the app session. It exchanges this one-time code in an authenticated function.
      result = { ...result, type: 'appUserConnectorOAuthComplete', code: JSON.stringify({ code, state }) };
    } catch { /* No provider query strings or credentials in logs. */ }
    const safe = JSON.stringify(result).replace(/</g, '\\u003c');
    const html = `<!doctype html><html lang="zh"><head><title>微软授权 · Oxford Bot</title></head><body><p>${result.code ? '正在完成微软连接…' : '授权未完成，请返回重试'}</p><script>history.replaceState(null,'',location.pathname);if(window.opener){window.opener.postMessage(${safe},location.origin);window.close();}</script></body></html>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'" } });
  } } },
});