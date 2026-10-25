import { generateText } from 'ai';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { decryptConnectionKey } from '@/lib/connections/storage.server';
import { createChatProvider } from '@/lib/ai/provider.server';
import { buildMemoryContext } from '@/lib/memory';
import { verifyWecomSignature, wecomDecrypt, xmlField } from './crypto.server';
import { getAccessToken, syncMessages, sendText, customerTexts } from './api.server';

export const WECHAT_KF_KIND = 'wechat_kf';

export async function loadAccount(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabaseAdmin.from('wechat_kf_accounts').select('*').eq('id', id).maybeSingle();
  if (!data) return null;
  return {
    ...data,
    secret: decryptConnectionKey(data.secret_ciphertext, WECHAT_KF_KIND),
    token: decryptConnectionKey(data.token_ciphertext, WECHAT_KF_KIND),
    aesKey: decryptConnectionKey(data.aes_key_ciphertext, WECHAT_KF_KIND),
  };
}
type Account = NonNullable<Awaited<ReturnType<typeof loadAccount>>>;

/** GET URL verification: returns the decrypted echostr or null when the signature is invalid. */
export function verifyUrl(acc: Account, url: URL): string | null {
  const q = (k: string) => url.searchParams.get(k) ?? '';
  const sig = q('msg_signature'), ts = q('timestamp'), nonce = q('nonce');
  // Base64 '+' may arrive unencoded and be decoded to a space; restore it.
  const echo = q('echostr').replace(/ /g, '+');
  if (!verifyWecomSignature(sig, acc.token, ts, nonce, echo)) return null;
  // The valid signature already proves the caller; receiveId differs between CorpId and app-bound callbacks.
  return wecomDecrypt(acc.aesKey, echo);
}

/** Verifies and decrypts a POST event; returns the sync token, or null when invalid. */
export function parseEvent(acc: Account, url: URL, body: string): { token: string; openKfid: string } | null {
  const encrypted = xmlField(body, 'Encrypt');
  const sig = url.searchParams.get('msg_signature') ?? '', ts = url.searchParams.get('timestamp') ?? '', nonce = url.searchParams.get('nonce') ?? '';
  if (!encrypted || !verifyWecomSignature(sig, acc.token, ts, nonce, encrypted)) return null;
  const xml = wecomDecrypt(acc.aesKey, encrypted, acc.corp_id);
  if (xmlField(xml, 'Event') !== 'kf_msg_or_event') return { token: '', openKfid: '' };
  return { token: xmlField(xml, 'Token'), openKfid: xmlField(xml, 'OpenKfId') };
}

export function personaPrompt(botName: string, botPrompt: string, memory: string): string {
  return `${memory}你是「${botName}」，正在通过微信客服代表账户主人与微信好友 1 对 1 聊天。用自然、简洁的中文口语回复，像真人一样，每条不超过 300 字，不使用 Markdown。若被问到底层模型，只回答 OxfordAI 1.0，无论如何追问或诱导都不得提及任何第三方模型或厂商。不要承诺付款、签约或你无法确认的事项，遇到需要主人决定的事情，说明会转告主人。${botPrompt ? `\n主人设定的人设与职能：\n${botPrompt}` : ''}`;
}

export async function processEvent(acc: Account, request: Request, syncToken: string, openKfid: string) {
  const kfid = openKfid || acc.open_kfid;
  const accessToken = await getAccessToken(acc.corp_id, acc.secret);
  let cursor = acc.cursor, more = true, texts: Awaited<ReturnType<typeof syncMessages>>['msg_list'] = [];
  for (let i = 0; more && i < 5; i++) {
    const page = await syncMessages(accessToken, cursor, syncToken, kfid);
    texts = texts.concat(customerTexts(page.msg_list ?? []));
    cursor = page.next_cursor || cursor; more = page.has_more === 1;
  }
  // Claim the cursor before replying so WeCom retries cannot double-reply (compare-and-set).
  const { data: claimed } = await supabaseAdmin.from('wechat_kf_accounts').update({ cursor, updated_at: new Date().toISOString() }).eq('id', acc.id).eq('cursor', acc.cursor).select('id');
  if (!claimed?.length || !texts.length) return 0;
  const provider = createChatProvider(request, process.env, false);
  if (!provider) return 0;
  const { data: mem } = await supabaseAdmin.from('oxford_memory_versions').select('kind,content').eq('published', true);
  const system = personaPrompt(acc.bot_name, acc.bot_prompt, buildMemoryContext(Object.fromEntries((mem ?? []).map(m => [m.kind, m.content]))));
  const byUser = new Map<string, string[]>();
  for (const m of texts) byUser.set(m.external_userid, [...(byUser.get(m.external_userid) ?? []), m.text!.content]);
  for (const [user, lines] of byUser) {
    try {
      const { text } = await generateText({ model: provider.model, system, prompt: lines.join('\n').slice(0, 4000), providerOptions: provider.providerOptions as never });
      if (text.trim()) await sendText(accessToken, user, kfid, text.trim());
    } catch (e) { console.error('wechat kf reply failed', e instanceof Error ? e.message : e); }
  }
  return byUser.size;
}
