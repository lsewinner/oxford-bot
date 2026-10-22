import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const U='11111111-1111-4111-8111-111111111111', CLOUD='22222222-2222-4222-8222-222222222222';
describe('Asana / Jira one-click oauth',()=>{
 beforeEach(()=>{process.env['APP_USER_CONNECTION_KEY_SECRET']=Buffer.alloc(32,7).toString('base64');for(const p of ['ASANA','JIRA']){process.env[`${p}_OAUTH_CLIENT_ID`]='cid';process.env[`${p}_OAUTH_CLIENT_SECRET`]='sec';}});
 afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
 it('binds state to user and provider',async()=>{
  const m=await import('@/lib/connections/rotating-oauth.server');
  const url=new URL(m.startRotatingAuthorization('jira',U,'https://oxford.bot/api/public/connections/jira/callback').authorizationUrl);
  expect(url.host).toBe('auth.atlassian.com');expect(url.searchParams.get('scope')).toContain('offline_access');
  const state=url.searchParams.get('state')!;
  expect(m.verifyRotatingState('jira',state).userId).toBe(U);
  expect(()=>m.verifyRotatingState('asana',state)).toThrow();
  const a=new URL(m.startRotatingAuthorization('asana',U,'https://oxford.bot/api/public/connections/asana/callback').authorizationUrl);
  expect(a.searchParams.get('code_challenge_method')).toBe('S256');
 });
 it('refuses to start without developer credentials',async()=>{
  delete process.env['ASANA_OAUTH_CLIENT_ID'];
  const m=await import('@/lib/connections/rotating-oauth.server');
  expect(()=>m.startRotatingAuthorization('asana',U,'https://oxford.bot/x')).toThrow('尚未配置');
 });
 it('exchanges a Jira code, picks the site and calls through the cloud API',async()=>{
  const fetcher=vi.fn(async(url:string)=>{
   if(url.includes('/oauth/token/accessible-resources'))return Response.json([{id:CLOUD,url:'https://acme.atlassian.net'}]);
   if(url.includes('/oauth/token'))return Response.json({access_token:'at',refresh_token:'rt',expires_in:3600});
   return Response.json({accountId:'acc1',emailAddress:'m@example.com'});
  });
  vi.stubGlobal('fetch',fetcher);
  const m=await import('@/lib/connections/rotating-oauth.server');
  const state=m.verifyRotatingState('jira',new URL(m.startRotatingAuthorization('jira',U,'https://oxford.bot/cb').authorizationUrl).searchParams.get('state')!);
  const r=await m.exchangeRotatingCode('jira','code',state);
  expect(r.account).toBe('jr-acc1@acme');expect(r.label).toBe('m@example.com @ acme.atlassian.net');
  expect(fetcher.mock.calls[2]?.[0]).toBe(`https://api.atlassian.com/ex/jira/${CLOUD}/rest/api/3/myself`);
  expect(JSON.parse(r.credential).cloudId).toBe(CLOUD);
 });
});
