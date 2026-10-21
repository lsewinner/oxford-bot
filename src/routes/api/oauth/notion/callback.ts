import { createFileRoute } from '@tanstack/react-router';

function html(success: boolean, message: string): Response {
  const result = { type: success ? 'appUserConnectorOAuthComplete' : 'appUserConnectorOAuthFailed', connectorId: 'notion', code: null };
  const safe = JSON.stringify(result).replace(/</g, '\\u003c');
  return new Response(
    `<!doctype html><html lang="zh"><head><title>Notion 授权 · Oxford Bot</title></head><body><p>${message}</p><script>history.replaceState(null,'',location.pathname);if(window.opener){window.opener.postMessage(${safe},location.origin);window.close();}</script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'" } },
  );
}

export const Route = createFileRoute('/api/oauth/notion/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        try {
          if (url.searchParams.get('error')) throw new Error('授权被取消');
          const code = url.searchParams.get('code');
          if (!code) throw new Error('授权缺少代码');
          const { verifyNotionState, exchangeNotionCode } = await import('@/lib/connections/notion-oauth.server');
          const payload = verifyNotionState(url.searchParams.get('state') ?? '');
          const result = await exchangeNotionCode(code, new URL('/api/oauth/notion/callback', url.origin).toString());
          const { saveConnection } = await import('@/lib/connections/storage.server');
          await saveConnection(payload.u, 'notion', result.token, 'personal_token', result.account, result.label);
          return html(true, '授权成功，正在保存连接…');
        } catch (e) {
          console.error('Notion OAuth callback failed:', e instanceof Error ? e.message : e);
          return html(false, '授权未完成，请返回重试');
        }
      },
    },
  },
});
