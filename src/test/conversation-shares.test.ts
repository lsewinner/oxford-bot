import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const chain = { middleware: () => chain, inputValidator: () => chain, handler: (handler: unknown) => handler };
  return chain;
} }));
vi.mock('@tanstack/react-start/server', () => ({ setResponseHeader: vi.fn() }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mocks.rpc }) }));
import { createShare, revokeShare, readShare } from '@/lib/shares.functions';
const call = (fn: unknown, data: object) => (fn as (input: object) => Promise<unknown>)({ data, context: { userId: 'owner-a', supabase: { from: mocks.from } } });
describe('public sharing boundaries', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('cannot share a thread that is not readable by its signed-in owner', async () => {
    const eq = vi.fn(); const chain = { select: () => chain, eq, maybeSingle: async () => ({ data: null }) }; eq.mockReturnValue(chain); mocks.from.mockReturnValue(chain);
    await expect(call(createShare, { threadId: 'foreign-thread' })).rejects.toThrow('会话不存在或无权分享');
    expect(eq).toHaveBeenCalledWith('user_id', 'owner-a');
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it('revokes only the owner’s active token and rejects a missing match', async () => {
    const eq = vi.fn(); const is = vi.fn(); const update = vi.fn();
    const chain = { update, eq, is, select: () => chain, maybeSingle: async () => ({ data: null, error: null }) };
    eq.mockReturnValue(chain); is.mockReturnValue(chain); update.mockReturnValue(chain); mocks.from.mockReturnValue(chain);
    await expect(call(revokeShare, { token: 'foreign-token' })).rejects.toThrow('链接已撤销或无权操作');
    expect(eq).toHaveBeenCalledWith('user_id', 'owner-a');
    expect(eq).toHaveBeenCalledWith('token', 'foreign-token');
    expect(is).toHaveBeenCalledWith('revoked_at', null);
    expect(update.mock.calls[0]?.[0].revoked_at).toEqual(expect.any(String));
  });
  it('reads only through the token-based public reader and returns unavailable for revoked links', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://test.invalid'); vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'test-key');
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    expect(await call(readShare, { token: 'revoked-token' })).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledWith('read_conversation_share', { p_token: 'revoked-token' });
    expect(mocks.from).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});