import { createFileRoute } from '@tanstack/react-router';

// WeCom Customer Service callback. Every request is verified with the account's own Token/EncodingAESKey.
export const Route = createFileRoute('/api/public/wechat-kf/$accountId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { loadAccount, verifyUrl } = await import('@/lib/wechat-kf/inbound.server');
        const acc = await loadAccount(params.accountId);
        if (!acc) return new Response('not found', { status: 404 });
        try {
          const echo = verifyUrl(acc, new URL(request.url));
          return echo === null ? new Response('invalid signature', { status: 401 }) : new Response(echo);
        } catch { return new Response('invalid', { status: 400 }); }
      },
      POST: async ({ request, params }) => {
        const { loadAccount, parseEvent, processEvent } = await import('@/lib/wechat-kf/inbound.server');
        const acc = await loadAccount(params.accountId);
        if (!acc) return new Response('not found', { status: 404 });
        const body = (await request.text()).slice(0, 20000);
        let event;
        try { event = parseEvent(acc, new URL(request.url), body); } catch { return new Response('invalid', { status: 400 }); }
        if (!event) return new Response('invalid signature', { status: 401 });
        if (acc.enabled && event.token) {
          try { await processEvent(acc, request, event.token, event.openKfid); } catch (e) { console.error('wechat kf event failed', e instanceof Error ? e.message : e); }
        }
        return new Response('success');
      },
    },
  },
});
