import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';
import { z } from 'zod';
import { isCatBreed } from './cat-breeds';

export type SharedBot = { token: string; name: string; kind: string; breed: string | null; systemPrompt: string; intro: string; featured: boolean };
export type FeaturedBot = { token: string; name: string; kind: string; breed: string | null; intro: string };

export function publicClient() {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
  return createClient<Database>(process.env['SUPABASE_URL']!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (key.startsWith('sb_') && h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization');
      h.set('apikey', key);
      return fetch(input, { ...init, headers: h });
    } },
  });
}

/** Server-side lookup used by the share page and the chat route; revoked shares return null. */
export async function readSharedBot(token: string): Promise<SharedBot | null> {
  const { data, error } = await publicClient().rpc('read_bot_share', { p_token: token });
  if (error) throw new Error('读取分享的 Bot 失败');
  const row = data?.[0];
  return row ? { token: row.token, name: row.name, kind: row.kind, breed: row.breed, systemPrompt: row.system_prompt, intro: row.intro, featured: row.featured } : null;
}

const tokenInput = z.object({ token: z.string().uuid() });
const createInput = z.object({
  name: z.string().trim().min(1).max(40),
  kind: z.enum(['general', 'mail', 'document', 'code', 'team']),
  breed: z.string().max(40).optional(),
  systemPrompt: z.string().max(8000).optional(),
  intro: z.string().trim().max(200).optional(),
});

export const getSharedBot = createServerFn({ method: 'GET' }).inputValidator((v) => tokenInput.parse(v))
  .handler(async ({ data }) => readSharedBot(data.token));

export const listFeaturedBots = createServerFn({ method: 'GET' }).handler(async (): Promise<FeaturedBot[]> => {
  const { data, error } = await publicClient().rpc('list_featured_bots');
  if (error) throw new Error('读取 Bot 广场失败');
  return (data ?? []).map((r) => ({ token: r.token, name: r.name, kind: r.kind, breed: r.breed, intro: r.intro }));
});

export const createBotShare = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v) => createInput.parse(v)).handler(async ({ data, context }) => {
    const { isProUser } = await import('./pro.server');
    // Personas are a Pro feature; a free owner's share carries only name, role and avatar.
    const pro = await isProUser(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: row, error } = await supabaseAdmin.from('bot_shares').insert({
      user_id: context.userId, name: data.name, kind: data.kind,
      breed: data.breed && isCatBreed(data.breed) ? data.breed : null,
      system_prompt: pro ? data.systemPrompt ?? '' : '', intro: data.intro ?? '',
    }).select('token').single();
    if (error || !row) throw new Error('创建分享链接失败');
    return { token: row.token };
  });

export const revokeBotShare = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v) => tokenInput.parse(v)).handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: rows, error } = await supabaseAdmin.from('bot_shares').update({ revoked_at: new Date().toISOString(), featured: false })
      .eq('token', data.token).eq('user_id', context.userId).is('revoked_at', null).select('id');
    if (error || !rows?.length) throw new Error('撤销失败或链接不存在');
    return { ok: true };
  });

export const isShareOwnerOrAdmin = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v) => tokenInput.parse(v)).handler(async ({ data, context }) => {
    const [{ data: admin }, { data: own }] = await Promise.all([
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' }),
      context.supabase.from('bot_shares').select('id').eq('token', data.token).is('revoked_at', null).maybeSingle(),
    ]);
    return { admin: admin === true, owner: Boolean(own) };
  });

export const setBotFeatured = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v) => tokenInput.extend({ featured: z.boolean() }).parse(v)).handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (admin !== true) throw new Error('只有管理员可以设置官方精选');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: rows, error } = await supabaseAdmin.from('bot_shares')
      .update({ featured: data.featured, featured_at: data.featured ? new Date().toISOString() : null })
      .eq('token', data.token).is('revoked_at', null).select('user_id,name');
    if (error || !rows?.length) throw new Error('更新精选失败');
    await supabaseAdmin.from('admin_audit_log').insert({ admin_id: context.userId, target_user_id: rows[0]!.user_id, action: data.featured ? 'bot_featured' : 'bot_unfeatured', details: { token: data.token, name: rows[0]!.name } });
    return { ok: true };
  });
