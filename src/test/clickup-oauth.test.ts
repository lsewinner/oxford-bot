import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{}}));
import { CLICKUP_CALLBACK, startClickUpAuthorization, verifyClickUpState, exchangeClickUpCode } from '@/lib/connections/clickup-oauth.server';
const owner='11111111-1111-4111-8111-111111111111';
const callback=`https://oxford.bot${CLICKUP_CALLBACK}`;
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('CLICKUP_OAUTH_CLIENT_ID','test-client');vi.stubEnv('CLICKUP_OAUTH_CLIENT_SECRET','test-secret');vi.stubEnv('PERSONAL_CONNECTION_SECRET','test-encryption-secret');vi.stubEnv('APP_USER_CONNECTION_KEY_SECRET','test-encryption-secret');});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers();});
describe('ClickUp one-click authorization',()=>{
 it('binds encrypted state to the user and exact callback',()=>{
  const url=new URL(startClickUpAuthorization(owner,callback).authorizationUrl);
  const state=verifyClickUpState(url.searchParams.get('state') ?? '');
  expect(state.userId).toBe(owner);expect(state.redirectUri).toBe(callback);
  expect(()=>verifyClickUpState((url.searchParams.get('state') ?? '').slice(0,-4)+'xxxx')).toThrow();
 });
 it('sends only the parameters ClickUp supports',()=>{
  const url=new URL(startClickUpAuthorization(owner,callback).authorizationUrl);
  expect(`${url.origin}${url.pathname}`).toBe('https://app.clickup.com/api');
  expect([...url.searchParams.keys()].sort()).toEqual(['client_id','redirect_uri','state']);
 });
 it('rejects expired state and missing developer credentials',()=>{
  vi.useFakeTimers();const state=new URL(startClickUpAuthorization(owner,callback).authorizationUrl).searchParams.get('state') ?? '';
  vi.advanceTimersByTime(600001);expect(()=>verifyClickUpState(state)).toThrow('已过期');
  vi.stubEnv('CLICKUP_OAUTH_CLIENT_SECRET','');expect(()=>startClickUpAuthorization(owner,callback)).toThrow('尚未配置');
 });
 it('exchanges the code with body credentials and stores the token under the ClickUp user id',async()=>{
  const fetcher=vi.fn(async(url:string)=>url.endsWith('/oauth/token')?Response.json({access_token:'clickup-access'}):Response.json({user:{id:42,username:'lsewinner'}}));vi.stubGlobal('fetch',fetcher);
  const state=verifyClickUpState(new URL(startClickUpAuthorization(owner,callback).authorizationUrl).searchParams.get('state') ?? '');
  const result=await exchangeClickUpCode('code',state);
  expect(result.account).toBe('cu-42');expect(result.credential).toBe('clickup-access');
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.clickup.com/api/v2/oauth/token');
  const init=(fetcher.mock.calls[0] as unknown as [string,RequestInit])[1];
  expect(JSON.parse(String(init.body))).toEqual({client_id:'test-client',client_secret:'test-secret',code:'code'});
  expect(init.headers).toEqual({ 'Content-Type':'application/json' });expect(init.redirect).toBe('manual');
 });
});
