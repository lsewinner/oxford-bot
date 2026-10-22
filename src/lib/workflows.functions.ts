import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { providerId } from './connections/catalog';

// Read saved state only: opening the drawer must not probe every provider.
export const workflowConnections = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('app_user_connections')
      .select('connector_id,account_key,account_label,enabled,reconnect_required')
      .eq('user_id', context.userId).order('created_at');
    if (error) throw new Error('无法读取工具账户，请重试');
    return (data ?? []).flatMap(row => {
      const parsed = providerId.safeParse(row.connector_id);
      if (!parsed.success || parsed.data === 'feishu') return [];
      return [{ provider: parsed.data, account: row.account_key || '', label: row.account_label || row.account_key || '默认账户', available: row.enabled && !row.reconnect_required, reconnectRequired: row.reconnect_required }];
    });
  });