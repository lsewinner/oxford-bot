import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';
import type { UIMessage } from 'ai';
import { z } from 'zod';
import { publicSnapshot, sharedMessageSchema } from './conversation-export';

const threadInput = z.object({ threadId: z.string().uuid() });
export const createShare = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(v => threadInput.parse(v)).handler(async ({ data, context }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const { data: thread } = await context.supabase.from('threads').select('title').eq('id', data.threadId).eq('user_id', context.userId).maybeSingle();
    if (!thread) throw new Error('会话不存在或无权分享');
    const { data: rows, error } = await context.supabase.from('messages').select('ui_id,role,parts').eq('thread_id', data.threadId).eq('user_id', context.userId).order('created_at');
    if (error) throw new Error('读取会话失败');
    const messages = publicSnapshot((rows ?? []).map(row => ({ id: row.ui_id ?? '', role: row.role, parts: row.parts })) as UIMessage[]);
    if (!messages.length) throw new Error('没有可分享的消息');
    const { data: share, error: saveError } = await context.supabase.from('conversation_shares').insert({ user_id: context.userId, thread_id: data.threadId, title: thread.title, messages: messages as never }).select('token').single();
    if (saveError || !share) throw new Error('创建分享失败');
    return { token: share.token };
  });
export const listShares = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(v => threadInput.parse(v)).handler(async ({ data, context }) => {
    setResponseHeader('Cache-Control', 'no-store');
    const { data: rows, error } = await context.supabase.from('conversation_shares').select('token,created_at').eq('thread_id', data.threadId).eq('user_id', context.userId).is('revoked_at', null).order('created_at', { ascending: false });
    if (error) throw new Error('读取分享链接失败');
    return rows ?? [];
  });
export const revokeShare = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator(v => z.object({ token: z.string().uuid() }).parse(v)).handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from('conversation_shares').update({ revoked_at: new Date().toISOString() }).eq('token', data.token).eq('user_id', context.userId).is('revoked_at', null).select('id').maybeSingle();
    if (error || !row) throw new Error('链接已撤销或无权操作');
    return { ok: true };
  });
export const readShare = createServerFn({ method: 'GET' }).inputValidator(v => z.object({ token: z.string().uuid() }).parse(v)).handler(async ({ data }) => {
  setResponseHeader('Cache-Control', 'no-store');
  const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) throw new Error('分享服务未配置');
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
    const headers = new Headers(init?.headers); headers.set('apikey', key); headers.delete('Authorization');
    return fetch(input, { ...init, headers });
  } } });
  const { data: rows, error } = await client.rpc('read_conversation_share', { p_token: data.token });
  if (error) throw new Error('读取分享失败');
  const row = rows?.[0];
  return row ? { title: row.title, createdAt: row.created_at, messages: z.array(sharedMessageSchema).parse(row.messages) } : null;
});