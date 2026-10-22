// Mainland China networks often cannot reach the backend host directly, so browser
// backend calls are routed through our own domain (/api/public/sb/*), which forwards them.
const PROXIED = /^\/(auth|rest|storage|functions)\/v1\//;

export function proxiedBackendUrl(url: string, backendUrl: string, origin: string): string | null {
  const base = backendUrl.replace(/\/+$/, '');
  if (!base || !url.startsWith(`${base}/`)) return null;
  const rest = url.slice(base.length);
  return PROXIED.test(rest) ? `${origin}/api/public/sb${rest}` : null;
}

if (typeof window !== 'undefined' && !(window as { __sbProxy?: boolean }).__sbProxy) {
  (window as { __sbProxy?: boolean }).__sbProxy = true;
  const backendUrl = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const target = backendUrl ? proxiedBackendUrl(url, backendUrl, window.location.origin) : null;
    if (!target) return original(input, init);
    return original(input instanceof Request ? new Request(target, input) : target, init);
  };
}
