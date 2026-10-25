import { createFileRoute } from '@tanstack/react-router';

// WeCom Customer Service callback. Every request is verified with the account's own Token/EncodingAESKey.
// WeCom drops URL verification after ~1s, so verified accounts are cached per isolate.
const cache = new Map<string, { at: number; acc: unknown }>();
async function cachedAccount(id: string) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < 60_000) return hit.acc as Awaited<ReturnType<typeof import('@/lib/wechat-kf/inbound.server')['loadAccount']>>;
  const { loadAccount } = await import('@/lib/wechat-kf/inbound.server');
  const acc = await loadAccount(id);
  if (acc) cache.set(id, { at: Date.now(), acc });
  return acc;
}

export const Route = createFileRoute('/api/public/wechat-kf/$accountId')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const [{ verifyUrl }, acc] = await Promise.all([import('@/lib/wechat-kf/inbound.server'), cachedAccount(params.accountId)]);
        if (!acc) return new Response('not found', { status: 404 });
        try {
          const echo = verifyUrl(acc, new URL(request.url));
          if (echo === null) { console.error('wechat kf verify: signature mismatch'); return new Response('invalid signature', { status: 401 }); }
          return new Response(echo, { headers: { 'content-type': 'text/plain' } });
        } catch (e) { console.error('wechat kf verify failed', e instanceof Error ? e.message : e); return new Response('invalid', { status: 400 }); }
      },
      POST: async ({ request, params }) => {
        const { loadAccount, parseEvent, processEvent } = await import('@/lib/wechat-kf/inbound.server');
        const acc = await loadAccount(params.accountId);
        if (!acc) return new Response('not found', { status: 404 });
        const body = (await request.text()).slice(0, 20000);
        let event;
        try { event = parseEvent(acc, new URL(request.url), body); } catch (e) { console.error('wechat kf event decrypt failed', e instanceof Error ? e.message : e); return new Response('invalid', { status: 400 }); }
        if (!event) return new Response('invalid signature', { status: 401 });
        if (acc.enabled && event.token) {
          try { await processEvent(acc, request, event.token, event.openKfid); } catch (e) { console.error('wechat kf event failed', e instanceof Error ? e.message : e); }
        }
        return new Response('success');
      },
    },
  },
});
