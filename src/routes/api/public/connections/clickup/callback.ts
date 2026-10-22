import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/connections/clickup/callback')({
  server: { handlers: { GET: async ({ request }) => {
    const url = new URL(request.url);
    let result = { type: 'appUserConnectorOAuthFailed', connectorId: 'clickup', code: null as string | null };
    try {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (url.searchParams.has('error') || !code || code.length > 8192 || !state) throw new Error('授权未完成');
      const { verifyClickUpState } = await import('@/lib/connections/clickup-oauth.server');
      const payload = verifyClickUpState(state);
      if (payload.redirectUri !== `${url.origin}${url.pathname}`) throw new Error('授权地址不匹配');
      // No credentials or writes here: only the authenticated opener can finish the exchange.
      result = { ...result, type: 'appUserConnectorOAuthComplete', code: JSON.stringify({ code, state }) };
    } catch { /* Do not log authorization query strings. */ }
    const safe = JSON.stringify(result).replace(/</g, '\\u003c');
    return new Response(`<!doctype html><html lang="zh"><head><title>ClickUp 授权 · Oxford Bot</title></head><body><p>${result.code ? '正在完成 ClickUp 连接…' : '授权未完成，请返回重试'}</p><script>history.replaceState(null,'',location.pathname);if(window.opener){window.opener.postMessage(${safe},location.origin);window.close();}</script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'" } });
  } } },
});
