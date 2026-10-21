// Fixed-host WeCom Customer Service API client (qyapi.weixin.qq.com only, no redirects).
const HOST = 'https://qyapi.weixin.qq.com/cgi-bin';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HOST}${path}`, { ...init, redirect: 'error', headers: { 'content-type': 'application/json' } });
  const body = await res.json() as T & { errcode?: number; errmsg?: string };
  if (!res.ok || (body.errcode && body.errcode !== 0)) throw new Error(`企业微信接口错误 ${body.errcode ?? res.status}: ${body.errmsg ?? ''}`.trim());
  return body;
}

export async function getAccessToken(corpId: string, secret: string): Promise<string> {
  const q = new URLSearchParams({ corpid: corpId, corpsecret: secret });
  const body = await call<{ access_token: string }>(`/gettoken?${q}`);
  return body.access_token;
}

export type KfMessage = { msgid: string; open_kfid: string; external_userid: string; origin: number; msgtype: string; text?: { content: string } };

export async function syncMessages(accessToken: string, cursor: string, token: string, openKfid: string) {
  return call<{ next_cursor: string; has_more: number; msg_list: KfMessage[] }>(`/kf/sync_msg?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST', body: JSON.stringify({ ...(cursor ? { cursor } : {}), token, open_kfid: openKfid, limit: 100 }),
  });
}

export async function sendText(accessToken: string, toUser: string, openKfid: string, content: string) {
  await call(`/kf/send_msg?access_token=${encodeURIComponent(accessToken)}`, {
    method: 'POST', body: JSON.stringify({ touser: toUser, open_kfid: openKfid, msgtype: 'text', text: { content: content.slice(0, 2000) } }),
  });
}

export async function listKfAccounts(accessToken: string) {
  return call<{ account_list: { open_kfid: string; name: string }[] }>(`/kf/account/list?access_token=${encodeURIComponent(accessToken)}`, { method: 'POST', body: JSON.stringify({ offset: 0, limit: 100 }) });
}

export async function addContactWay(accessToken: string, openKfid: string): Promise<string> {
  const body = await call<{ url: string }>(`/kf/add_contact_way?access_token=${encodeURIComponent(accessToken)}`, { method: 'POST', body: JSON.stringify({ open_kfid: openKfid, scene: 'oxford' }) });
  return body.url;
}

/** Customer text messages only (origin 3); our own replies and events are skipped. */
export function customerTexts(list: KfMessage[]): KfMessage[] {
  return list.filter(m => m.origin === 3 && m.msgtype === 'text' && m.text?.content?.trim());
}
