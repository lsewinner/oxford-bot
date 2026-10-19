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
 it('falls back to the connection secret when the token key is missing',()=>{
  vi.stubEnv('PERSONAL_TOKEN_ENCRYPTION_SECRET','');vi.stubEnv('APP_USER_CONNECTION_KEY_SECRET','');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test-only-service-key');
  const ct=encryptConnectionKey('test-only-credential','personal_token');
  expect(decryptConnectionKey(ct,'personal_token')).toBe('test-only-credential');
 });
 it('oauth credentials encrypt without APP_USER_CONNECTION_KEY_SECRET by using the token key',()=>{
  vi.stubEnv('APP_USER_CONNECTION_KEY_SECRET','');vi.stubEnv('PERSONAL_TOKEN_ENCRYPTION_SECRET','test-only-encryption-key');
  const ct=encryptConnectionKey('refresh-token','google_oauth');
  expect(decryptConnectionKey(ct,'google_oauth')).toBe('refresh-token');
 });
 it('never encrypts with a guessable key when no server secret exists',()=>{
  vi.stubEnv('PERSONAL_TOKEN_ENCRYPTION_SECRET','');vi.stubEnv('APP_USER_CONNECTION_KEY_SECRET','');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');
  expect(()=>encryptConnectionKey('x','oauth')).toThrow();
 });
});