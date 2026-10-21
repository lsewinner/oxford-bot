import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

const accountInput = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().max(60).default(''),
  corpId: z.string().trim().regex(/^[A-Za-z0-9_-]{4,64}$/),
  secret: z.string().trim().max(256).optional(),
  token: z.string().trim().regex(/^[A-Za-z0-9]{1,32}$/).optional(),
  aesKey: z.string().trim().regex(/^[A-Za-z0-9]{43}$/).optional(),
  openKfid: z.string().trim().max(64).default(''),
  botName: z.string().trim().min(1).max(40),
  botPrompt: z.string().max(8000).default(''),
}).strict();

export const listWechatKf = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('wechat_kf_accounts').select('id,label,corp_id,open_kfid,bot_name,enabled,created_at').eq('user_id', context.userId).order('created_at');
  if (error) throw new Error('读取微信客服失败');
  return data ?? [];
});

export const saveWechatKf = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(v => accountInput.parse(v)).handler(async ({ data, context }) => {
  await (await import('./pro.server')).requirePro(context.supabase as never, context.userId);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { encryptConnectionKey } = await import('./connections/storage.server');
  const enc = (v: string) => encryptConnectionKey(v, 'wechat_kf');
  const base = { label: data.label, corp_id: data.corpId, open_kfid: data.openKfid, bot_name: data.botName, bot_prompt: data.botPrompt, updated_at: new Date().toISOString() };
  if (data.id) {
    const patch = { ...base, ...(data.secret ? { secret_ciphertext: enc(data.secret) } : {}), ...(data.token ? { token_ciphertext: enc(data.token) } : {}), ...(data.aesKey ? { aes_key_ciphertext: enc(data.aesKey) } : {}) };
    const { error } = await supabaseAdmin.from('wechat_kf_accounts').update(patch).eq('id', data.id).eq('user_id', context.userId);
    if (error) throw new Error('保存失败');
    return { id: data.id };
  }
  if (!data.secret || !data.token || !data.aesKey) throw new Error('请填写 Secret、Token 与 EncodingAESKey');
  const { data: row, error } = await supabaseAdmin.from('wechat_kf_accounts').insert({ ...base, user_id: context.userId, secret_ciphertext: enc(data.secret), token_ciphertext: enc(data.token), aes_key_ciphertext: enc(data.aesKey) }).select('id').single();
  if (error || !row) throw new Error('保存失败');
  return { id: row.id };
});

export const updateWechatKf = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(v => z.object({ id: z.string().uuid(), enabled: z.boolean().optional(), remove: z.boolean().optional() }).strict().parse(v)).handler(async ({ data, context }) => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const q = supabaseAdmin.from('wechat_kf_accounts');
  const { error } = data.remove ? await q.delete().eq('id', data.id).eq('user_id', context.userId) : await q.update({ enabled: Boolean(data.enabled), updated_at: new Date().toISOString() }).eq('id', data.id).eq('user_id', context.userId);
  if (error) throw new Error('更新失败');
  return { ok: true };
});

/** Verifies the saved credentials with WeCom and returns customer-service accounts plus a share link. */
export const testWechatKf = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(v => z.object({ id: z.string().uuid() }).strict().parse(v)).handler(async ({ data, context }) => {
  const { loadAccount } = await import('./wechat-kf/inbound.server');
  const acc = await loadAccount(data.id);
  if (!acc || acc.user_id !== context.userId) throw new Error('未找到账户');
  const { getAccessToken, listKfAccounts, addContactWay } = await import('./wechat-kf/api.server');
  try {
    const token = await getAccessToken(acc.corp_id, acc.secret);
    const { account_list } = await listKfAccounts(token);
    const kfid = acc.open_kfid || account_list[0]?.open_kfid || '';
    const link = kfid ? await addContactWay(token, kfid).catch(() => '') : '';
    return { accounts: account_list.map(a => ({ id: a.open_kfid, name: a.name })), link, kfid };
  } catch (e) { throw new Error(e instanceof Error ? e.message : '连接企业微信失败'); }
});
