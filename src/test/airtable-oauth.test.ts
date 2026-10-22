import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(()=>({replace:vi.fn(),get:vi.fn()}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{}}));
vi.mock('@/lib/connections/storage.server',async importOriginal=>{
 const actual=await importOriginal<typeof import('@/lib/connections/storage.server')>();
 return {...actual,replaceAirtableCredential:storage.replace,getConnection:storage.get};
});
import { AIRTABLE_CALLBACK, startAirtableAuthorization, verifyAirtableState, exchangeAirtableCode, callWithAirtableCredential } from '@/lib/connections/airtable-oauth.server';
import { encryptConnectionKey } from '@/lib/connections/storage.server';
const owner='11111111-1111-4111-8111-111111111111';
const callback=`https://oxford.bot${AIRTABLE_CALLBACK}`;
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('AIRTABLE_OAUTH_CLIENT_ID','test-client');vi.stubEnv('AIRTABLE_OAUTH_CLIENT_SECRET','test-secret');vi.stubEnv('PERSONAL_CONNECTION_SECRET','test-encryption-secret');vi.stubEnv('APP_USER_CONNECTION_KEY_SECRET','test-encryption-secret');});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers();});
describe('Airtable one-click authorization',()=>{
 it('binds encrypted state to the user and exact callback with S256 PKCE',()=>{
  const url=new URL(startAirtableAuthorization(owner,callback).authorizationUrl);
  const state=verifyAirtableState(url.searchParams.get('state') ?? '');
  expect(state.userId).toBe(owner);expect(state.redirectUri).toBe(callback);
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(state.verifier).digest('base64url'));
  expect(()=>verifyAirtableState((url.searchParams.get('state') ?? '').slice(0,-4)+'xxxx')).toThrow();
 });
 it('rejects expired state and missing developer credentials',()=>{
  vi.useFakeTimers();const state=new URL(startAirtableAuthorization(owner,callback).authorizationUrl).searchParams.get('state') ?? '';
  vi.advanceTimersByTime(600001);expect(()=>verifyAirtableState(state)).toThrow('已过期');
  vi.stubEnv('AIRTABLE_OAUTH_CLIENT_SECRET','');expect(()=>startAirtableAuthorization(owner,callback)).toThrow('尚未配置');
 });
 it('exchanges once with verifier and persists a tagged credential under Airtable user identity',async()=>{
  const fetcher=vi.fn(async(url:string)=>url.endsWith('/token')?Response.json({access_token:'access',refresh_token:'refresh',expires_in:3600}):Response.json({id:'usr123',email:'test@example.com'}));vi.stubGlobal('fetch',fetcher);
  const state=verifyAirtableState(new URL(startAirtableAuthorization(owner,callback).authorizationUrl).searchParams.get('state') ?? '');
  const result=await exchangeAirtableCode('code',state);
  expect(result.account).toBe('at-usr123');expect(JSON.parse(result.credential).refreshToken).toBe('refresh');
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://airtable.com/oauth2/v1/token');
  const init=(fetcher.mock.calls[0] as unknown as [string,RequestInit])[1];
  expect(new URLSearchParams(String(init.body)).get('code_verifier')).toBe(state.verifier);expect(init.redirect).toBe('manual');
 });
 it('keeps plain PAT accounts working',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({bases:[]}));vi.stubGlobal('fetch',fetcher);
  await callWithAirtableCredential(owner,{id:'row',account_key:'at-usr123',connection_key_ciphertext:encryptConnectionKey('pat-existing','personal_token')},'/v0/meta/bases');
  expect((fetcher.mock.calls[0]?.[1].headers as Headers).get('Authorization')).toBe('Bearer pat-existing');expect(storage.replace).not.toHaveBeenCalled();
 });
 it('refreshes only after claiming a lease and saves rotated credentials before reading',async()=>{
  const old={provider:'airtable_oauth',accessToken:'old',refreshToken:'refresh-old',expiresAt:0};
  storage.replace.mockResolvedValueOnce('claimed').mockResolvedValueOnce('saved');
  const fetcher=vi.fn(async(url:string)=>url.endsWith('/token')?Response.json({access_token:'new',refresh_token:'refresh-new',expires_in:3600}):Response.json({bases:[]}));vi.stubGlobal('fetch',fetcher);
  await callWithAirtableCredential(owner,{id:'row',account_key:'at-usr123',connection_key_ciphertext:encryptConnectionKey(JSON.stringify(old),'personal_token')},'/v0/meta/bases');
  expect(storage.replace).toHaveBeenCalledTimes(2);expect(JSON.parse(storage.replace.mock.calls[1]?.[3]).refreshToken).toBe('refresh-new');
  expect((fetcher.mock.calls[1] as unknown as [string,{headers:Headers}])[1].headers.get('Authorization')).toBe('Bearer new');
 });
});