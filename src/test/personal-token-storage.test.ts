import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({upsert:vi.fn()}));
vi.mock('@/integrations/supabase/client.server',()=>({supabaseAdmin:{from:()=>({upsert:mocks.upsert})}}));
import { encryptConnectionKey,decryptConnectionKey,saveConnection } from '@/lib/connections/storage.server';
describe('personal token encrypted storage',()=>{
 afterEach(()=>vi.unstubAllEnvs());
 it('stores ciphertext for the owner/provider and decrypts only server-side',async()=>{
  vi.stubEnv('PERSONAL_TOKEN_ENCRYPTION_SECRET','test-only-encryption-key');mocks.upsert.mockResolvedValue({error:null});
  await saveConnection('owner-a','github','test-only-credential','personal_token');
  const row=mocks.upsert.mock.calls.at(-1)?.[0];
  expect(row.user_id).toBe('owner-a');expect(row.connector_id).toBe('github');expect(row.credential_kind).toBe('personal_token');
  expect(row.connection_key_ciphertext).not.toBe('test-only-credential');
  expect(decryptConnectionKey(row.connection_key_ciphertext,'personal_token')).toBe('test-only-credential');
 });
 it('refuses saving tokens without the app encryption key',()=>{
  vi.stubEnv('PERSONAL_TOKEN_ENCRYPTION_SECRET','');
  expect(()=>encryptConnectionKey('test-only-credential','personal_token')).toThrow('Token 加密尚未配置');
 });
});