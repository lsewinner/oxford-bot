import { describe, expect, it, beforeEach, vi } from 'vitest';
const mocks=vi.hoisted(()=>({verify:vi.fn(),exchange:vi.fn(),account:vi.fn(),save:vi.fn()}));
vi.mock('@tanstack/react-start',()=>({createServerFn:()=>{const c={middleware:()=>c,inputValidator:()=>c,handler:(h:unknown)=>h};return c;}}));
vi.mock('@tanstack/react-start/server',()=>({getRequest:()=>new Request('https://app.example/chat')}));
vi.mock('@/integrations/supabase/auth-middleware',()=>({requireSupabaseAuth:{}}));
vi.mock('@/lib/connections/storage.server',()=>({saveConnection:mocks.save}));
vi.mock('@/lib/connections/microsoft-oauth.server',()=>({verifyMicrosoftState:mocks.verify,exchangeMicrosoftCode:mocks.exchange,getMicrosoftAccount:mocks.account}));
import { completeMicrosoftOAuth } from '@/lib/connections.functions';
const complete=()=> (completeMicrosoftOAuth as unknown as (v:object)=>Promise<unknown>)({data:{code:'one-time',state:'encrypted'},context:{userId:'owner-a'}});
describe('Microsoft opener-authenticated completion',()=>{
 it('Teams saves only the provider bound in authenticated state',async()=>{mocks.verify.mockReturnValue({provider:'microsoft_teams',userId:'owner-a',redirectUri:'https://app.example/api/oauth/microsoft/callback'});await complete();expect(mocks.save).toHaveBeenCalledWith('owner-a','microsoft_teams','refresh','microsoft_oauth','microsoft:id-a','a@example.com');});

 beforeEach(()=>{vi.clearAllMocks();mocks.verify.mockReturnValue({provider:'microsoft_outlook',userId:'owner-a',redirectUri:'https://app.example/api/oauth/microsoft/callback'});mocks.exchange.mockResolvedValue({accessToken:'access',refreshToken:'refresh'});mocks.account.mockResolvedValue({account:'microsoft:id-a',label:'a@example.com'});});
 it('saves refresh access for the authenticated owner and stable account only after exchange',async()=>{
  expect(await complete()).toEqual({ok:true});expect(mocks.save).toHaveBeenCalledWith('owner-a','microsoft_outlook','refresh','microsoft_oauth','microsoft:id-a','a@example.com');
 });
 it('cannot attach another app user’s Microsoft authorization',async()=>{
  mocks.verify.mockReturnValue({userId:'owner-b',redirectUri:'https://app.example/api/oauth/microsoft/callback'});await expect(complete()).rejects.toThrow('不属于');expect(mocks.exchange).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
 });
 it('rejects a callback origin mismatch without exchanging or saving',async()=>{
  mocks.verify.mockReturnValue({provider:'microsoft_outlook',userId:'owner-a',redirectUri:'https://other.example/api/oauth/microsoft/callback'});await expect(complete()).rejects.toThrow('地址');expect(mocks.exchange).not.toHaveBeenCalled();
 });
 it('never claims success or saves if token exchange fails',async()=>{
  mocks.exchange.mockRejectedValue(new Error('denied'));await expect(complete()).rejects.toThrow('denied');expect(mocks.save).not.toHaveBeenCalled();
 });
});