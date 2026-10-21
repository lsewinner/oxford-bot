import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callWithPersonalToken, personalTokenIdentity, validatePersonalToken } from '@/lib/connections/personal-token.server';
import { isWrite, validateOperation, operationInput } from '@/lib/connections/catalog';
const mocks=vi.hoisted(()=>({get:vi.fn(),insert:vi.fn()}));
vi.mock('@/lib/connections/storage.server',()=>({getConnection:mocks.get,decryptConnectionKey:()=> 'test-token',rotateMicrosoftCredential:vi.fn(),rotateLinearCredential:vi.fn()}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{from:()=>({insert:mocks.insert})}}));
import { executeOperation } from '@/lib/connections/execute.server';
const fetcher=vi.fn();
beforeEach(()=>{
 vi.clearAllMocks();vi.stubGlobal('fetch',fetcher);
 mocks.get.mockResolvedValue({enabled:true,credential_kind:'personal_token',account_key:'yq-42',connection_key_ciphertext:'encrypted'});
 mocks.insert.mockReturnValue({select:()=>({single:async()=>({data:{id:'proposal'},error:null})})});
});
afterEach(()=>vi.unstubAllGlobals());
describe('Yuque personal connection',()=>{
 it('validates user via the token header on the fixed host',async()=>{
  fetcher.mockResolvedValue(Response.json({data:{id:42,login:'michael',name:'Michael'}}));
  await validatePersonalToken('yuque','test-token');
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://www.yuque.com/api/v2/user');
  const headers=fetcher.mock.calls[0]?.[1].headers as Headers;
  expect(headers.get('X-Auth-Token')).toBe('test-token');expect(headers.has('Authorization')).toBe(false);
  expect(await personalTokenIdentity('yuque','test-token',{data:{id:42,login:'michael',name:'Michael'}})).toEqual({account:'yq-42',label:'Michael'});
 });
 it('blocks deletion, traversal and arbitrary hosts',async()=>{
  for(const path of ['/repos/a/b/docs/1','/repos/a/../docs/1','https://evil.example/user'])
   await expect(callWithPersonalToken('yuque','test-token',path,{method:'DELETE'})).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('requires knowledge base and document identifiers from lists',()=>{
  expect(()=>validateOperation('yuque',{operation:'docs'})).toThrow();
  expect(()=>validateOperation('yuque',{operation:'read',repo:'a/b'})).toThrow();
  expect(()=>validateOperation('yuque',{operation:'read',repo:'a/b',id:'12'})).not.toThrow();
  expect(()=>operationInput.parse({operation:'repos',offset:-1})).toThrow();
 });
 it('requires complete replacement content',()=>{
  expect(()=>validateOperation('yuque',{operation:'update_doc',repo:'a/b',id:'12',text:'body'})).toThrow();
 });
 it('keeps document writes pending with the selected account',async()=>{
  for(const operation of ['create_doc','update_doc']){
   expect(isWrite(operation)).toBe(true);
   expect((await executeOperation('owner','yuque',{operation,repo:'a/b',id:'12',title:'Title',text:'Body'})).status).toBe('confirmation_required');
  }
  expect(fetcher).not.toHaveBeenCalled();expect(mocks.insert.mock.calls[0]?.[0].payload.account).toBe('yq-42');
 });
 it('reads knowledge bases using the actual user login and requested page',async()=>{
  fetcher.mockResolvedValueOnce(Response.json({data:{id:42,login:'michael'}})).mockResolvedValueOnce(Response.json({data:[{namespace:'michael/notes',name:'Notes',private_token:'hidden'}]}));
  const result=await executeOperation('owner','yuque',{operation:'repos',offset:50});
  expect(fetcher.mock.calls[1]?.[0]).toBe('https://www.yuque.com/api/v2/users/michael/repos?offset=50&limit=50');
  expect(result.items?.[0]?.id).toBe('michael/notes');expect(JSON.stringify(result)).not.toContain('hidden');
 });
 it('reads Markdown doc bodies',async()=>{
  fetcher.mockResolvedValue(Response.json({data:{id:12,title:'Notes',slug:'notes',body:'# Hello'}}));
  const result=await executeOperation('owner','yuque',{operation:'read',repo:'michael/book',id:'12'});
  expect(result.text).toBe('# Hello');expect(result.items?.[0]?.url).toBe('https://www.yuque.com/michael/book/notes');
 });
 it('creates private Markdown documents only when confirmed',async()=>{
  fetcher.mockResolvedValue(Response.json({data:{id:12,title:'New',slug:'new'}}));
  const result=await executeOperation('owner','yuque',{operation:'create_doc',repo:'a/b',title:'New',text:'# Body'},true);
  expect(result.status).toBe('completed');
  expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual({title:'New',body:'# Body',format:'markdown',public:0});
 });
 it('preserves the existing visibility on a confirmed update',async()=>{
  fetcher.mockResolvedValueOnce(Response.json({data:{id:12,public:2}})).mockResolvedValueOnce(Response.json({data:{id:12,title:'Update'}}));
  await executeOperation('owner','yuque',{operation:'update_doc',repo:'a/b',id:'12',title:'Update',text:'Full body'},true);
  expect(fetcher.mock.calls[1]?.[1].method).toBe('PUT');expect(JSON.parse(fetcher.mock.calls[1]?.[1].body).public).toBe(2);
 });
 it('never reports an API refusal as a successful write',async()=>{
  fetcher.mockResolvedValue(new Response('{}',{status:403}));
  await expect(executeOperation('owner','yuque',{operation:'create_doc',repo:'a/b',title:'New',text:'Body'},true)).rejects.toThrow('权限不足');
 });
});