import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callWithPersonalToken, personalTokenIdentity, validatePersonalToken, parseJiraCredential } from '@/lib/connections/personal-token.server';
import { isWrite, validateOperation } from '@/lib/connections/catalog';
const mocks=vi.hoisted(()=>({get:vi.fn(),insert:vi.fn(),token:'' as string,account:'' as string}));
vi.mock('@/lib/connections/storage.server',()=>({getConnection:mocks.get,decryptConnectionKey:()=>mocks.token,rotateMicrosoftCredential:vi.fn(),rotateLinearCredential:vi.fn()}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{from:()=>({insert:mocks.insert})}}));
import { executeOperation } from '@/lib/connections/execute.server';
const fetcher=vi.fn();
const TG='123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsawQ';
const JIRA='acme.atlassian.net|m@example.com|tok123';
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',fetcher);
 mocks.get.mockImplementation(async()=>({enabled:true,credential_kind:'personal_token',account_key:mocks.account,connection_key_ciphertext:'enc'}));
 mocks.insert.mockReturnValue({select:()=>({single:async()=>({data:{id:'p'},error:null})})});});
afterEach(()=>vi.unstubAllGlobals());
describe('Telegram',()=>{
 it('validates via getMe with the token in the bot path and keys by bot id',async()=>{
  fetcher.mockResolvedValue(Response.json({ok:true,result:{id:42,username:'oxbot'}}));
  const body=await validatePersonalToken('telegram',TG);
  expect(fetcher.mock.calls[0]?.[0]).toBe(`https://api.telegram.org/bot${TG}/getMe`);
  expect(await personalTokenIdentity('telegram',TG,body)).toEqual({account:'tg-42',label:'@oxbot'});
 });
 it('rejects malformed tokens and unlisted methods',async()=>{
  await expect(callWithPersonalToken('telegram','abc/../x','/getMe')).rejects.toThrow();
  await expect(callWithPersonalToken('telegram',TG,'/deleteWebhook',{method:'POST'})).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('holds sending for confirmation, then sends once confirmed',async()=>{
  mocks.token=TG;mocks.account='tg-42';
  expect(isWrite('send_message')).toBe(true);
  expect(()=>validateOperation('telegram',{operation:'send_message',text:'hi'})).toThrow();
  const r=await executeOperation('owner','telegram',{operation:'send_message',id:'-1001',text:'hi'});
  expect(r.status).toBe('confirmation_required');expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockResolvedValue(Response.json({ok:true,result:{message_id:7}}));
  await executeOperation('owner','telegram',{operation:'send_message',id:'-1001',text:'hi'},true);
  expect(fetcher.mock.calls[0]?.[0]).toBe(`https://api.telegram.org/bot${TG}/sendMessage`);
  expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual({chat_id:'-1001',text:'hi'});
 });
});
describe('Asana',()=>{
 it('validates with bearer token and keys by user gid',async()=>{
  fetcher.mockResolvedValue(Response.json({data:{gid:'1201',email:'m@example.com'}}));
  const body=await validatePersonalToken('asana','2/abc');
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://app.asana.com/api/1.0/users/me');
  expect((fetcher.mock.calls[0]?.[1].headers as Headers).get('Authorization')).toBe('Bearer 2/abc');
  expect(await personalTokenIdentity('asana','2/abc',body)).toEqual({account:'as-1201',label:'m@example.com'});
 });
 it('requires a project and confirms before creating a task',async()=>{
  mocks.token='2/abc';mocks.account='as-1201';
  expect(()=>validateOperation('asana',{operation:'tasks'})).toThrow();
  expect((await executeOperation('owner','asana',{operation:'create_task',id:'555',title:'T'})).status).toBe('confirmation_required');
  fetcher.mockResolvedValue(Response.json({data:{gid:'9',name:'T'}}));
  await executeOperation('owner','asana',{operation:'create_task',id:'555',title:'T',text:'B'},true);
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://app.asana.com/api/1.0/tasks');
  expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual({data:{name:'T',notes:'B',projects:['555']}});
 });
});
describe('Jira',()=>{
 it('only accepts atlassian.net sites and uses basic auth there',async()=>{
  expect(()=>parseJiraCredential('evil.com|m@example.com|t')).toThrow();
  expect(()=>parseJiraCredential('acme.atlassian.net.evil.com|m@example.com|t')).toThrow();
  fetcher.mockResolvedValue(Response.json({accountId:'5b10:abc',emailAddress:'m@example.com'}));
  const body=await validatePersonalToken('jira',JIRA);
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://acme.atlassian.net/rest/api/3/myself');
  expect((fetcher.mock.calls[0]?.[1].headers as Headers).get('Authorization')).toBe(`Basic ${btoa('m@example.com:tok123')}`);
  expect(await personalTokenIdentity('jira',JIRA,body)).toEqual({account:'jr-5b10:abc@acme',label:'m@example.com @ acme.atlassian.net'});
 });
 it('confirms before creating an issue, then posts to the user site',async()=>{
  mocks.token=JIRA;mocks.account='jr-5b10:abc@acme';
  expect(()=>validateOperation('jira',{operation:'issue',id:'eng-1'})).toThrow();
  expect((await executeOperation('owner','jira',{operation:'create_issue',repo:'ENG',title:'Bug',text:'Steps'})).status).toBe('confirmation_required');
  expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockResolvedValue(Response.json({key:'ENG-7'}));
  const r=await executeOperation('owner','jira',{operation:'create_issue',repo:'ENG',title:'Bug',text:'Steps'},true);
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://acme.atlassian.net/rest/api/3/issue');
  expect(JSON.parse(fetcher.mock.calls[0]?.[1].body).fields.project).toEqual({key:'ENG'});
  expect(r.items?.[0]?.url).toBe('https://acme.atlassian.net/browse/ENG-7');
 });
});
