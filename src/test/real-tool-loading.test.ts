import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool } from 'ai';
import { providerId, type OperationInput } from '@/lib/connections/catalog';
import { SERVICE_TOOL_GUIDANCE } from '@/lib/ai/tool-guidance';

const mocks = vi.hoisted(() => ({ connections: vi.fn(), execute: vi.fn() }));
vi.mock('@/lib/connections/storage.server', () => ({ getConnections: mocks.connections }));
vi.mock('@/lib/connections/execute.server', () => ({ executeOperation: mocks.execute }));
import { createRealTools } from '@/lib/ai/tools.server';

describe('scoped real tool loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connections.mockResolvedValue([]);
  });

  it('covers every supported provider without adding unsupported services', () => {
    expect(Object.keys(SERVICE_TOOL_GUIDANCE).sort()).toEqual([...providerId.options].sort());
  });

  it('never loads personal tools without an owner', async () => {
    expect(await createRealTools(null)).toEqual({});
    expect(mocks.connections).not.toHaveBeenCalled();
  });

  it('excludes disabled and reconnect-required connections', async () => {
    mocks.connections.mockImplementation(async (_owner: string, id: string) => {
      if (id === 'github') return [{ enabled: true, reconnect_required: false, account_key: 'gh-1' }];
      if (id === 'slack') return [{ enabled: false, reconnect_required: false }];
      if (id === 'google_mail') return [{ enabled: true, reconnect_required: true }];
      return [];
    });
    expect(Object.keys(await createRealTools('owner-a'))).toEqual(['service_github']);
  });

  it('passes the selected account and owner unchanged, never confirms a model write', async () => {
    mocks.connections.mockImplementation(async (_owner: string, id: string) => id === 'google_mail'
      ? [{ enabled: true, reconnect_required: false, account_key: 'mail-a' }, { enabled: true, reconnect_required: false, account_key: 'mail-b' }] : []);
    mocks.execute.mockResolvedValue({ status: 'confirmation_required', actionId: 'proposal' });
    const tools = await createRealTools('owner-a');
    const mailTool = tools['service_google_mail'] as Tool<OperationInput, unknown> | undefined;
    const send = mailTool?.execute;
    if (!send) throw new Error('Mail execution missing');
    const input = { operation: 'send', account: 'mail-b', to: 'recipient@example.com', title: 'Meeting', text: 'Agenda' };
    const result = await send(input, { toolCallId: 'call-1', messages: [], context: undefined });
    expect(mocks.execute).toHaveBeenCalledExactlyOnceWith('owner-a', 'google_mail', input);
    expect(result).toEqual({ status: 'confirmation_required', actionId: 'proposal' });
  });
});