import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callWithPersonalToken, personalTokenIdentity, validatePersonalToken, parseFeishuCredential } from '@/lib/connections/personal-token.server';
import { isWrite, validateOperation } from '@/lib/connections/catalog';
const mocks=vi.hoisted(()=>({get:vi.fn(),insert:vi.fn()}));
vi.mock('@/lib/connections/storage.server',()=>({getConnection:mocks.get,decryptConnectionKey:()=> 'cli_abc123:secret',rotateMicrosoftCredential:vi.fn(),rotateLinearCredential:vi.fn()}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{from:()=>({insert:mocks.insert})}}));
import { executeOperation } from '@/lib/connections/execute.server';
const fetcher=vi.fn();
const tenant=()=>Response.json({code:0,tenant_access_token:'t-123'});
beforeEach(()=>{
 vi.clearAllMocks();vi.stubGlobal('fetch',fetcher);
 mocks.get.mockResolvedValue({enabled:true,credential_kind:'personal_token',account_key:'fs-cli_abc123',connection_key_ciphertext:'enc'});
 mocks.insert.mockReturnValue({select:()=>({single:async()=>({data:{id:'proposal'},error:null})})});
});
afterEach(()=>vi.unstubAllGlobals());
describe('Feishu connection',()=>{
 it('exchanges app credentials for a tenant token and identifies the app',async()=>{
  fetcher.mockResolvedValueOnce(tenant()).mockResolvedValueOnce(Response.json({code:0,bot:{app_name:'Oxford'}}));
  const body=await validatePersonalToken('feishu','cli_abc123:secret');
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal');
  expect(fetcher.mock.calls[1]?.[0]).toBe('https://open.feishu.cn/open-apis/bot/v3/info');
  expect((fetcher.mock.calls[1]?.[1].headers as Headers).get('Authorization')).toBe('Bearer t-123');
  expect(await personalTokenIdentity('feishu','cli_abc123:secret',body)).toEqual({account:'fs-cli_abc123',label:'Oxford'});
 });
 it('rejects malformed credentials and unlisted paths',async()=>{
  expect(()=>parseFeishuCredential('nocolon')).toThrow();
  await expect(callWithPersonalToken('feishu','cli_abc123:secret','/drive/v1/files/x',{method:'DELETE'})).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('requires identifiers and a JSON object for new records',()=>{
  expect(()=>validateOperation('feishu',{operation:'read_doc'})).toThrow();
  expect(()=>validateOperation('feishu',{operation:'add_record',repo:'appToken1',id:'tbl123',text:'[1]'})).toThrow();
  expect(()=>validateOperation('feishu',{operation:'add_record',repo:'appToken1',id:'tbl123',text:'{"名称":"A"}'})).not.toThrow();
  expect(isWrite('add_record')).toBe(true);
 });
 it('adding a record only creates a pending confirmation',async()=>{
  const r=await executeOperation('u1','feishu',{operation:'add_record',repo:'appToken1',id:'tbl123',text:'{"名称":"A"}'});
  expect(r.status).toBe('confirmation_required');expect(fetcher).not.toHaveBeenCalled();
 });
 it('reads document plain text',async()=>{
  fetcher.mockResolvedValueOnce(tenant()).mockResolvedValueOnce(Response.json({code:0,data:{content:'你好飞书'}}));
  const r=await executeOperation('u1','feishu',{operation:'read_doc',repo:'doxcnABC123'});
  expect(fetcher.mock.calls[1]?.[0]).toBe('https://open.feishu.cn/open-apis/docx/v1/documents/doxcnABC123/raw_content');
  expect(r.text).toBe('你好飞书');
 });
});
