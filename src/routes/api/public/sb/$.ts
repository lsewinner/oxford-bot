import { createFileRoute } from '@tanstack/react-router';

// Transparent forwarder to our own backend only (fixed host); the caller's own
// apikey/bearer headers are passed through and the backend enforces all access rules.
const ALLOWED = /^\/(auth|rest|storage|functions)\/v1\//;
const DROP = ['host', 'cookie', 'connection', 'content-length', 'accept-encoding', 'cf-connecting-ip', 'x-forwarded-for', 'x-real-ip'];

async function forward(request: Request): Promise<Response> {
  const base = process.env['SUPABASE_URL']?.replace(/\/+$/, '');
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/public\/sb/, '');
  if (!base || !ALLOWED.test(path)) return new Response('Not found', { status: 404 });
  const headers = new Headers(request.headers);
  for (const h of DROP) headers.delete(h);
  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const upstream = await fetch(base + path + url.search, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: 'manual',
  });
  const out = new Headers(upstream.headers);
  out.delete('content-encoding');
  out.delete('content-length');
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const Route = createFileRoute('/api/public/sb/$')({
  server: {
    handlers: { GET: ({ request }) => forward(request), POST: ({ request }) => forward(request), PUT: ({ request }) => forward(request), PATCH: ({ request }) => forward(request), DELETE: ({ request }) => forward(request), HEAD: ({ request }) => forward(request), OPTIONS: ({ request }) => forward(request) },
  },
});
