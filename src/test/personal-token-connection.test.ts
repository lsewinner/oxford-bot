import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({validate:vi.fn(),save:vi.fn(),pro:vi.fn()}));
vi.mock('@tanstack/react-start',()=>({createServerFn:()=>{const c={middleware:()=>c,inputValidator:()=>c,handler:(h:unknown)=>h};return c;}}));
vi.mock('@tanstack/react-start/server',()=>({getRequest:vi.fn()}));
vi.mock('@/integrations/supabase/auth-middleware',()=>({requireSupabaseAuth:{}}));
vi.mock('@/lib/connections/personal-token.server',()=>({validatePersonalToken:mocks.validate,personalTokenIdentity:async()=>({account:'',label:''})}));
vi.mock('@/lib/connections/storage.server',()=>({saveConnection:mocks.save}));
vi.mock('@/lib/pro.server',()=>({requirePro:mocks.pro,isProUser:async()=>true}));
import { connectPersonalToken } from '@/lib/connections.functions';
const call=(id:'github'|'slack')=>(connectPersonalToken as unknown as (v:object)=>Promise<unknown>)({data:{id,token:'test-only-credential'},context:{userId:'owner-a'}});
describe('personal token connection registration',()=>{
 beforeEach(()=>{vi.clearAllMocks();});
 it('validates and stores the token for its authenticated owner without an OAuth client',async()=>{
  mocks.validate.mockResolvedValue(undefined);mocks.save.mockResolvedValue(undefined);
  expect(await call('github')).toEqual({ok:true});
  expect(mocks.validate).toHaveBeenCalledWith('github','test-only-credential');
  expect(mocks.save).toHaveBeenCalledWith('owner-a','github','test-only-credential','personal_token','','');
 });
 it('never persists an invalid token or claims connection success',async()=>{
  mocks.validate.mockRejectedValue(new Error('Token 已失效'));
  await expect(call('slack')).rejects.toThrow('Token 已失效');
  expect(mocks.save).not.toHaveBeenCalled();
 });
});describe('Pro gate on real tool connections',()=>{
 it('free accounts cannot connect a real tool',async()=>{
  mocks.pro.mockRejectedValueOnce(new Error('该功能需要 Pro 会员，请先升级'));
  await expect(call('github')).rejects.toThrow('Pro');
  expect(mocks.save).not.toHaveBeenCalled();
 });
});
