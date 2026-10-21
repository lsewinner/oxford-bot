import { createFileRoute } from '@tanstack/react-router';

function html(success: boolean, message: string): Response {
  const result = { type: success ? 'appUserConnectorOAuthComplete' : 'appUserConnectorOAuthFailed', connectorId: 'github', code: null };
  const safe = JSON.stringify(result).replace(/</g, '\\u003c');
  return new Response(
    `<!doctype html><html lang="zh"><head><title>GitHub 授权 · Oxford Bot</title></head><body><p>${message}</p><script>history.replaceState(null,'',location.pathname);if(window.opener){window.opener.postMessage(${safe},location.origin);window.close();}</script></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'" } },
  );
}

export const Route = createFileRoute('/api/oauth/github/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        try {
          if (url.searchParams.get('error')) throw new Error('授权被取消');
          const code = url.searchParams.get('code');
          if (!code) throw new Error('授权缺少代码');
          const { verifyGithubState, exchangeGithubCode } = await import('@/lib/connections/github-oauth.server');
          const payload = verifyGithubState(url.searchParams.get('state') ?? '');
          const result = await exchangeGithubCode(code, new URL('/api/oauth/github/callback', url.origin).toString());
          const { saveConnection } = await import('@/lib/connections/storage.server');
          await saveConnection(payload.u, 'github', result.token, 'personal_token', result.account, result.label);
          return html(true, '授权成功，正在保存连接…');
        } catch (e) {
          console.error('GitHub OAuth callback failed:', e instanceof Error ? e.message : e);
          return html(false, '授权未完成，请返回重试');
        }
      },
    },
  },
});
