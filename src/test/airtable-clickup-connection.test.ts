import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callWithPersonalToken, personalTokenIdentity, validatePersonalToken } from '@/lib/connections/personal-token.server';
import { isWrite, validateOperation } from '@/lib/connections/catalog';
const mocks=vi.hoisted(()=>({get:vi.fn(),insert:vi.fn(),token:'' as string}));
vi.mock('@/lib/connections/storage.server',()=>({getConnection:mocks.get,decryptConnectionKey:()=>mocks.token,rotateMicrosoftCredential:vi.fn(),rotateLinearCredential:vi.fn()}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{from:()=>({insert:mocks.insert})}}));
import { executeOperation } from '@/lib/connections/execute.server';
const fetcher=vi.fn();
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',fetcher);mocks.token='pat-token';
 mocks.get.mockResolvedValue({enabled:true,credential_kind:'personal_token',account_key:'at-usr1',connection_key_ciphertext:'enc'});
 mocks.insert.mockReturnValue({select:()=>({single:async()=>({data:{id:'p'},error:null})})});});
afterEach(()=>vi.unstubAllGlobals());
describe('Airtable',()=>{
 it('validates on the fixed host and keys accounts by user id',async()=>{
  fetcher.mockResolvedValue(Response.json({id:'usrAbc123456',email:'m@example.com'}));
  const body=await validatePersonalToken('airtable','pat-token');
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.airtable.com/v0/meta/whoami');
  expect((fetcher.mock.calls[0]?.[1].headers as Headers).get('Authorization')).toBe('Bearer pat-token');
  expect(await personalTokenIdentity('airtable','pat-token',body)).toEqual({account:'at-usrAbc123456',label:'m@example.com'});
 });
 it('blocks other methods, hosts and traversal',async()=>{
  for(const [path,method] of <[string,string][]>[['/v0/appAAAAAAAAAAAAAA/tblX?pageSize=100','DELETE'],['/v0/appAAAA/../x','GET'],['https://evil.example/v0/meta/whoami','GET'],['/v0/meta/bases/appAAAAAAAAAAAAAA/tables','POST']])
   await expect(callWithPersonalToken('airtable','t',path,{method})).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('requires base/table ids and holds record creation for confirmation',async()=>{
  expect(()=>validateOperation('airtable',{operation:'tables'})).toThrow();
  expect(()=>validateOperation('airtable',{operation:'records',id:'appAAAAAAAAAAAAAA'})).toThrow();
  expect(()=>validateOperation('airtable',{operation:'create_record',id:'appAAAAAAAAAAAAAA',repo:'客户表',text:'[1]'})).toThrow();
  expect(isWrite('create_record')).toBe(true);
  const r=await executeOperation('owner','airtable',{operation:'create_record',id:'appAAAAAAAAAAAAAA',repo:'tblXxx',text:'{"名称":"A"}'});
  expect(r.status).toBe('confirmation_required');expect(fetcher).not.toHaveBeenCalled();
 });
 it('creates the record once confirmed',async()=>{
  fetcher.mockResolvedValue(Response.json({id:'rec1',fields:{名称:'A'}}));
  await executeOperation('owner','airtable',{operation:'create_record',id:'appAAAAAAAAAAAAAA',repo:'客户表',text:'{"名称":"A"}'},true);
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.airtable.com/v0/appAAAAAAAAAAAAAA/%E5%AE%A2%E6%88%B7%E8%A1%A8');
  expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual({fields:{名称:'A'}});
 });
});
describe('ClickUp',()=>{
 it('validates with the plain token header and keys accounts by user id',async()=>{
  mocks.token='pk-token';
  fetcher.mockResolvedValue(Response.json({user:{id:123,username:'michael'}}));
  const body=await validatePersonalToken('clickup','pk-token');
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.clickup.com/api/v2/user');
  expect((fetcher.mock.calls[0]?.[1].headers as Headers).get('Authorization')).toBe('pk-token');
  expect(await personalTokenIdentity('clickup','pk-token',body)).toEqual({account:'cu-123',label:'michael'});
 });
 it('blocks other methods, hosts and traversal',async()=>{
  for(const [path,method] of <[string,string][]>[['/api/v2/team/1/task','DELETE'],['/api/v2/team/1/../user','GET'],['https://evil.example/api/v2/user','GET']])
   await expect(callWithPersonalToken('clickup','t',path,{method})).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('requires the team id and holds task creation for confirmation',async()=>{
  expect(()=>validateOperation('clickup',{operation:'tasks'})).toThrow();
  expect(isWrite('create_task')).toBe(true);
  const r=await executeOperation('owner','clickup',{operation:'create_task',id:'901',title:'T',text:'B'});
  expect(r.status).toBe('confirmation_required');expect(fetcher).not.toHaveBeenCalled();
 });
 it('creates the task once confirmed',async()=>{
  fetcher.mockResolvedValue(Response.json({id:'task1',name:'T',url:'https://app.clickup.com/t/1'}));
  await executeOperation('owner','clickup',{operation:'create_task',id:'901',title:'T',text:'B'},true);
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.clickup.com/api/v2/team/901/task');
  expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual({name:'T',content:'B'});
 });
});
