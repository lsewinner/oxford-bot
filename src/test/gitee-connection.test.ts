import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callWithPersonalToken, personalTokenIdentity, validatePersonalToken } from '@/lib/connections/personal-token.server';
import { isWrite, validateOperation } from '@/lib/connections/catalog';
const mocks=vi.hoisted(()=>({get:vi.fn(),insert:vi.fn(),token:'' as string}));
vi.mock('@/lib/connections/storage.server',()=>({getConnection:mocks.get,decryptConnectionKey:()=>mocks.token,rotateMicrosoftCredential:vi.fn(),rotateLinearCredential:vi.fn()}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{from:()=>({insert:mocks.insert})}}));
import { executeOperation } from '@/lib/connections/execute.server';
const fetcher=vi.fn();
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',fetcher);mocks.token='gitee-token';
 mocks.get.mockResolvedValue({enabled:true,credential_kind:'personal_token',account_key:'gt-7',connection_key_ciphertext:'enc'});
 mocks.insert.mockReturnValue({select:()=>({single:async()=>({data:{id:'p'},error:null})})});});
afterEach(()=>vi.unstubAllGlobals());
describe('Gitee',()=>{
 it('validates on the fixed host and keys accounts by user id',async()=>{
  fetcher.mockResolvedValue(Response.json({id:7,login:'mh',name:'Michael'}));
  const body=await validatePersonalToken('gitee','gitee-token');
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://gitee.com/api/v5/user');
  expect((fetcher.mock.calls[0]?.[1].headers as Headers).get('Authorization')).toBe('token gitee-token');
  expect(await personalTokenIdentity('gitee','gitee-token',body)).toEqual({account:'gt-7',label:'Michael'});
 });
 it('blocks deletes, other hosts and traversal',async()=>{
  for(const [path,method] of <[string,string][]>[['/repos/a/b','DELETE'],['/repos/a/../x/issues?state=open&per_page=20','GET'],['https://evil.example/user','GET']])
   await expect(callWithPersonalToken('gitee','t',path,{method})).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('requires owner/repo and holds issue creation for confirmation',async()=>{
  expect(()=>validateOperation('gitee',{operation:'issues'})).toThrow();
  expect(isWrite('create_issue')).toBe(true);
  const r=await executeOperation('owner','gitee',{operation:'create_issue',repo:'a/b',title:'T',text:'B'});
  expect(r.status).toBe('confirmation_required');expect(fetcher).not.toHaveBeenCalled();
 });
 it('creates the issue on the owner endpoint once confirmed',async()=>{
  fetcher.mockResolvedValue(Response.json({number:'I1',title:'T',html_url:'https://gitee.com/a/b/issues/I1'}));
  await executeOperation('owner','gitee',{operation:'create_issue',repo:'a/b',title:'T',text:'B'},true);
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://gitee.com/api/v5/repos/a/issues');
  expect(JSON.parse(fetcher.mock.calls[0]?.[1].body)).toEqual({repo:'b',title:'T',body:'B'});
 });
});
