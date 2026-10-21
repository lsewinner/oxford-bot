import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const owner='11111111-1111-4111-8111-111111111111';
const storage=vi.hoisted(()=>({from:vi.fn()}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{from:storage.from}}));

describe('Microsoft direct OAuth',()=>{
 beforeEach(()=>{vi.stubEnv('APP_USER_CONNECTION_KEY_SECRET','test-encryption-key');vi.stubEnv('MICROSOFT_OAUTH_CLIENT_ID','11111111-2222-4333-8444-555555555555');vi.stubEnv('MICROSOFT_OAUTH_CLIENT_SECRET','test-secret');});
 afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.useRealTimers();vi.clearAllMocks();});
 it.each([undefined,'','  ','MICROSOFT_OAUTH_CLIENT_ID','${MICROSOFT_OAUTH_CLIENT_ID}','prefix-MICROSOFT_OAUTH_CLIENT_ID-suffix','not-a-uuid'])('falls back to the requested Client ID for invalid config %s',async(value)=>{
  vi.stubEnv('MICROSOFT_OAUTH_CLIENT_ID',value);
  const {startMicrosoftAuthorization,verifyMicrosoftState,exchangeMicrosoftCode}=await import('@/lib/connections/microsoft-oauth.server');
  const url=new URL(startMicrosoftAuthorization(owner,'https://app.example/cb').authorizationUrl);
  expect(url.searchParams.get('client_id')).toBe('dfb5197c-fa51-4233-9fbf-02bc4ff8eca2');
  const fetcher=vi.fn().mockResolvedValue(Response.json({access_token:'test-access',refresh_token:'test-refresh'}));vi.stubGlobal('fetch',fetcher);
  await exchangeMicrosoftCode('code',verifyMicrosoftState(url.searchParams.get('state') ?? ''));
  expect((fetcher.mock.calls[0]?.[1].body as URLSearchParams).get('client_id')).toBe('dfb5197c-fa51-4233-9fbf-02bc4ff8eca2');
 });
 it('preserves a valid configured UUID instead of using the default',async()=>{
  vi.stubEnv('MICROSOFT_OAUTH_CLIENT_ID','  11111111-2222-4333-8444-555555555555  ');
  const {startMicrosoftAuthorization}=await import('@/lib/connections/microsoft-oauth.server');
  expect(new URL(startMicrosoftAuthorization(owner,'https://app.example/cb').authorizationUrl).searchParams.get('client_id')).toBe('11111111-2222-4333-8444-555555555555');
 });
 it.each([undefined,'','  ','MICROSOFT_OAUTH_CLIENT_SECRET','${MICROSOFT_OAUTH_CLIENT_SECRET}','placeholder','your-client-secret','<client-secret>','xxx','replace-me'])('rejects empty or placeholder secrets %s before contacting Microsoft',async(value)=>{
  vi.stubEnv('MICROSOFT_OAUTH_CLIENT_SECRET',value);const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  const {startMicrosoftAuthorization,callWithMicrosoftToken}=await import('@/lib/connections/microsoft-oauth.server');
  expect(()=>startMicrosoftAuthorization(owner,'https://app.example/cb')).toThrow();
  await expect(callWithMicrosoftToken('refresh','/me')).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
 });
 it('requests personal/work account selection and every required mail scope with S256 PKCE',async()=>{
  const {startMicrosoftAuthorization,verifyMicrosoftState}=await import('@/lib/connections/microsoft-oauth.server');
  const url=new URL(startMicrosoftAuthorization(owner,'https://app.example/api/oauth/microsoft/callback').authorizationUrl);
  expect(url.origin+url.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  expect(url.searchParams.get('prompt')).toBe('select_account');
  expect(url.searchParams.get('scope')?.split(' ')).toEqual(['openid','profile','email','offline_access','User.Read','Mail.Read','Mail.ReadWrite','Mail.Send']);
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  const state=url.searchParams.get('state') ?? '';
  const verified=verifyMicrosoftState(state);
  expect(verified.userId).toBe(owner);expect(verified.redirectUri).toBe('https://app.example/api/oauth/microsoft/callback');
  expect(state).not.toContain(verified.verifier);expect(url.searchParams.get('code_challenge')).toHaveLength(43);
 });
 it('rejects tampered and expired encrypted state',async()=>{
  const {startMicrosoftAuthorization,verifyMicrosoftState}=await import('@/lib/connections/microsoft-oauth.server');
  const state=new URL(startMicrosoftAuthorization(owner,'https://app.example/cb').authorizationUrl).searchParams.get('state') ?? '';
  expect(()=>verifyMicrosoftState('AAAA'+state.slice(4))).toThrow();
  vi.useFakeTimers();vi.setSystemTime(Date.now()+11*60*1000);expect(()=>verifyMicrosoftState(state)).toThrow('过期');
 });
 it('exchanges the code using the original callback and PKCE verifier and requires refresh access',async()=>{
  const {startMicrosoftAuthorization,verifyMicrosoftState,exchangeMicrosoftCode}=await import('@/lib/connections/microsoft-oauth.server');
  const state=verifyMicrosoftState(new URL(startMicrosoftAuthorization(owner,'https://app.example/cb').authorizationUrl).searchParams.get('state') ?? '');
  const fetcher=vi.fn().mockResolvedValue(Response.json({access_token:'test-access',refresh_token:'test-refresh'}));vi.stubGlobal('fetch',fetcher);
  expect(await exchangeMicrosoftCode('one-time-code',state)).toEqual({accessToken:'test-access',refreshToken:'test-refresh'});
  const body=fetcher.mock.calls[0]?.[1].body as URLSearchParams;
  expect(body.get('redirect_uri')).toBe('https://app.example/cb');expect(body.get('code_verifier')).toBe(state.verifier);
  fetcher.mockResolvedValueOnce(Response.json({access_token:'test-access'}));await expect(exchangeMicrosoftCode('code',state)).rejects.toThrow('持续访问');
 });
 it('keys multiple accounts by Graph identity rather than mutable email',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({id:'graph-id-1',mail:'me@example.com'})));
  const {getMicrosoftAccount}=await import('@/lib/connections/microsoft-oauth.server');
  expect(await getMicrosoftAccount('test-access')).toEqual({account:'microsoft:graph-id-1',label:'me@example.com'});
 });
 it('refreshes, persists replacement tokens, and sends mail only to the fixed Graph host',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(Response.json({access_token:'test-access',refresh_token:'rotated-refresh'})).mockResolvedValueOnce(new Response(null,{status:202}));vi.stubGlobal('fetch',fetcher);
  const rotate=vi.fn().mockResolvedValue(undefined);
  const {callWithMicrosoftToken}=await import('@/lib/connections/microsoft-oauth.server');
  expect((await callWithMicrosoftToken('old-refresh','/me/sendMail',{method:'POST',body:'{}'},rotate)).status).toBe(202);
  expect(rotate).toHaveBeenCalledWith('rotated-refresh');expect(fetcher.mock.calls[1]?.[0]).toBe('https://graph.microsoft.com/v1.0/me/sendMail');
  expect(fetcher.mock.calls[1]?.[1].redirect).toBe('manual');
 });
 it('refuses arbitrary hosts, paths and operations before using credentials',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  const {callWithMicrosoftToken}=await import('@/lib/connections/microsoft-oauth.server');
  for(const path of ['https://evil.example/x','//evil.example/x','/me/../users','/me/%2e%2e/users','/users','/me/messages/x/attachments'])await expect(callWithMicrosoftToken('refresh',path)).rejects.toThrow('不支持');
  await expect(callWithMicrosoftToken('refresh','/me/messages',{method:'DELETE'})).rejects.toThrow('不支持');expect(fetcher).not.toHaveBeenCalled();
 });
 it('never follows a provider redirect carrying credentials',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({access_token:'access'})).mockResolvedValueOnce(new Response(null,{status:302,headers:{Location:'https://evil.example'}})));
  const {callWithMicrosoftToken}=await import('@/lib/connections/microsoft-oauth.server');
  expect((await callWithMicrosoftToken('refresh','/me')).status).toBe(502);
 });
 it('marks revoked refresh grants as reconnect instead of connected',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({error:'invalid_grant'},{status:400})));
  const {callWithMicrosoftToken,MicrosoftReconnectError}=await import('@/lib/connections/microsoft-oauth.server');
  await expect(callWithMicrosoftToken('revoked','/me')).rejects.toBeInstanceOf(MicrosoftReconnectError);
 });
 it('requests the calendar scope only for the Outlook calendar connection',async()=>{
  const {startMicrosoftAuthorization}=await import('@/lib/connections/microsoft-oauth.server');
  const url=new URL(startMicrosoftAuthorization(owner,'https://app.example/api/oauth/microsoft/callback','microsoft_calendar').authorizationUrl);
  expect(url.searchParams.get('scope')?.split(' ')).toEqual(['openid','profile','email','offline_access','User.Read','Calendars.ReadWrite']);
 });
 it('allows only calendar reads and confirmed event creation on the fixed Graph host',async()=>{
  const fetcher=vi.fn().mockImplementation(() => Response.json({access_token:'test-access'}));vi.stubGlobal('fetch',fetcher);
  const {callWithMicrosoftToken}=await import('@/lib/connections/microsoft-oauth.server');
  expect((await callWithMicrosoftToken('refresh','/me/calendars?$top=50',undefined,undefined,'microsoft_calendar')).ok).toBe(true);
  expect((await callWithMicrosoftToken('refresh','/me/calendarView?startDateTime=2026-10-22T00%3A00%3A00Z&endDateTime=2026-11-05T00%3A00%3A00Z&%24top=50',undefined,undefined,'microsoft_calendar')).ok).toBe(true);
  expect((await callWithMicrosoftToken('refresh','/me/events',{method:'POST',body:'{}'},undefined,'microsoft_calendar')).ok).toBe(true);
  fetcher.mockClear();
  await expect(callWithMicrosoftToken('refresh','/me/events/evt-1',{method:'PATCH'},undefined,'microsoft_calendar')).rejects.toThrow('不支持');
  await expect(callWithMicrosoftToken('refresh','/me/events/evt-1',{method:'DELETE'},undefined,'microsoft_calendar')).rejects.toThrow('不支持');
  await expect(callWithMicrosoftToken('refresh','/me/sendMail',{method:'POST'},undefined,'microsoft_calendar')).rejects.toThrow('不支持');
  await expect(callWithMicrosoftToken('refresh','/me/messages',undefined,undefined,'microsoft_calendar')).rejects.toThrow('不支持');
  expect(fetcher).not.toHaveBeenCalled();
 });
});