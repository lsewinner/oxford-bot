import { createServerFn } from '@tanstack/react-start';
import { createClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Database } from '@/integrations/supabase/types';
import { z } from 'zod';
import { isCatBreed } from './cat-breeds';
import { SQUARE_CATEGORIES, canSubmitToSquare, type SquareBot, type SubmissionStatus } from './bot-square';

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

export const listMyBotShares = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('bot_shares').select('token,name,created_at')
      .eq('user_id', context.userId).is('revoked_at', null).order('created_at', { ascending: false }).limit(50);
    if (error) throw new Error('读取分享链接失败');
    return data ?? [];
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

const submitInput = tokenInput.extend({ category: z.enum(SQUARE_CATEGORIES), intro: z.string().trim().max(200).optional() });

/** Owner asks for review; only paid members may submit, and approval stays admin-only. */
export const submitBotToSquare = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v) => submitInput.parse(v)).handler(async ({ data, context }) => {
    const { isProUser } = await import('./pro.server');
    if (!canSubmitToSquare(await isProUser(context.supabase as never, context.userId))) throw new Error('发布到 Bot 广场为 Pro 会员权益');
    const meta = (context.claims as { user_metadata?: { nickname?: string } }).user_metadata;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: rows, error } = await supabaseAdmin.from('bot_shares').update({
      category: data.category, submission_status: 'pending', submitted_at: new Date().toISOString(),
      creator_name: (meta?.nickname ?? '').slice(0, 40), ...(data.intro ? { intro: data.intro } : {}),
    }).eq('token', data.token).eq('user_id', context.userId).is('revoked_at', null).eq('featured', false).select('id');
    if (error || !rows?.length) throw new Error('提交失败：链接不存在或已上架');
    return { ok: true };
  });

export const listMySubmissions = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from('bot_shares').select('token,submission_status,featured')
      .eq('user_id', context.userId).is('revoked_at', null).limit(50);
    if (error) throw new Error('读取提交状态失败');
    return (data ?? []).map((r) => ({ token: r.token, status: (r.featured ? 'approved' : r.submission_status) as SubmissionStatus }));
  });

async function assertAdmin(context: { supabase: { rpc: (...a: never[]) => unknown }; userId: string }) {
  const { data } = await (context.supabase as never as { rpc: (n: string, a: object) => Promise<{ data: unknown }> }).rpc('has_role', { _user_id: context.userId, _role: 'admin' });
  if (data !== true) throw new Error('只有管理员可以审核');
}

export const listBotSubmissions = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin.from('bot_shares')
      .select('token,name,kind,breed,intro,category,creator_name,submission_status,submitted_at,featured,user_id')
      .in('submission_status', ['pending', 'approved', 'rejected']).is('revoked_at', null)
      .order('submitted_at', { ascending: false }).limit(200);
    if (error) throw new Error('读取审核列表失败');
    return data ?? [];
  });

export const reviewBotSubmission = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v) => tokenInput.extend({ approve: z.boolean() }).parse(v)).handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const now = new Date().toISOString();
    const { data: rows, error } = await supabaseAdmin.from('bot_shares').update({
      submission_status: data.approve ? 'approved' : 'rejected', reviewed_at: now,
      featured: data.approve, featured_at: data.approve ? now : null,
    }).eq('token', data.token).is('revoked_at', null).neq('submission_status', 'none').select('user_id,name');
    if (error || !rows?.length) throw new Error('审核失败');
    await supabaseAdmin.from('admin_audit_log').insert({ admin_id: context.userId, target_user_id: rows[0]!.user_id, action: data.approve ? 'bot_approved' : 'bot_rejected', details: { token: data.token, name: rows[0]!.name } });
    return { ok: true };
  });

export const listSquareBots = createServerFn({ method: 'GET' }).handler(async (): Promise<SquareBot[]> => {
  const { data, error } = await publicClient().rpc('list_square_bots');
  if (error) throw new Error('读取 Bot 广场失败');
  return (data ?? []).map((r) => ({ token: r.token, name: r.name, kind: r.kind, breed: r.breed, intro: r.intro, category: r.category, creatorName: r.creator_name, official: r.official }));
});
