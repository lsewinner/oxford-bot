import { beforeEach,describe,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({get:vi.fn(),call:vi.fn(),insert:vi.fn(),decrypt:vi.fn()}));
vi.mock('@/lib/connections/storage.server',()=>({getConnection:mocks.get,decryptConnectionKey:mocks.decrypt}));
vi.mock('@/integrations/lovable/appUserConnector',()=>({callAsAppUser:mocks.call,appUserReconnectRequired:async()=>false}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{from:()=>({insert:mocks.insert})}}));
import { executeOperation } from '@/lib/connections/execute.server';
describe('personal provider execution',()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.get.mockResolvedValue({id:'row',enabled:true,reconnect_required:false,connection_key_ciphertext:'encrypted'});mocks.decrypt.mockReturnValue('private-test-handle');mocks.insert.mockReturnValue({select:()=>({single:async()=>({data:{id:'proposal'},error:null})})});});
 it('a model mail send stores a proposal for its authenticated owner, never sends',async()=>{
 const input={operation:'send',to:'recipient@example.com',title:'测试',text:'正文'};
 const result=await executeOperation('owner-a','google_mail',input);
 expect(result.status).toBe('confirmation_required');expect(mocks.call).not.toHaveBeenCalled();
 expect(mocks.get).toHaveBeenCalledWith('owner-a','google_mail');
 expect(mocks.insert).toHaveBeenCalledWith({user_id:'owner-a',connector_id:'google_mail',operation:'send',payload:input});
 });
 it('disabled connections cannot run even a confirmed write',async()=>{mocks.get.mockResolvedValue({enabled:false});const result=await executeOperation('owner-a','slack',{operation:'send',id:'channel',text:'hello'},true);expect(result.status).toBe('error');expect(mocks.call).not.toHaveBeenCalled();});
 it('expired grants require reconnect without calling the provider',async()=>{mocks.get.mockResolvedValue({enabled:true,reconnect_required:true});expect((await executeOperation('owner-a','github',{operation:'repos'})).status).toBe('reconnect_required');expect(mocks.call).not.toHaveBeenCalled();});
 it('reads only using the signed-in owner connection and returns selected fields',async()=>{mocks.call.mockResolvedValue(Response.json([{full_name:'owner-a/site',html_url:'https://github.com/owner-a/site',description:'site',token:'must-not-return'}]));const result=await executeOperation('owner-a','github',{operation:'repos'});expect(result.items).toEqual([{title:'owner-a/site',id:'owner-a/site',url:'https://github.com/owner-a/site',detail:'site'}]);expect(JSON.stringify(result)).not.toContain('must-not-return');expect(mocks.call.mock.calls[0]?.[0].connectorId).toBe('github');});
 it('a provider refusal never reports completed',async()=>{mocks.call.mockResolvedValue(new Response('{"message":"denied"}',{status:403}));await expect(executeOperation('owner-a','github',{operation:'repos'})).rejects.toThrow('403');});
});