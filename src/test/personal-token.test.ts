import { afterEach, describe, expect, it, vi } from 'vitest';
import { callWithPersonalToken, validatePersonalToken, personalTokenError } from '@/lib/connections/personal-token.server';
describe('personal provider tokens', () => {
 afterEach(()=>vi.unstubAllGlobals());
 it('calls GitHub on its fixed host without following redirects',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({id:1}));vi.stubGlobal('fetch',fetcher);
  await validatePersonalToken('github','test-only-credential');
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.github.com/user');
  expect(fetcher.mock.calls[0]?.[1].redirect).toBe('error');
 });
 it('rejects arbitrary hosts and paths before sending credentials',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  await expect(callWithPersonalToken('github','test-only-credential','https://other.invalid/user')).rejects.toThrow('不支持');
  await expect(callWithPersonalToken('slack','test-only-credential','/api/other')).rejects.toThrow('不支持');
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('rejects Slack HTTP 200 with ok false without exposing the response',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({ok:false,error:'invalid_auth',private:'do not expose'})));
  await expect(validatePersonalToken('slack','test-only-credential')).rejects.toThrow('Slack Token 已失效');
 });
 it('does not retry a denied token',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response('private',{status:403}));vi.stubGlobal('fetch',fetcher);
  await expect(validatePersonalToken('github','test-only-credential')).rejects.toThrow('权限不足');
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('gives useful errors for missing permissions and channel membership',()=>{
  expect(personalTokenError('slack',200,'missing_scope')).toContain('权限不足');
  expect(personalTokenError('slack',200,'not_in_channel')).toContain('加入目标频道');
 });
});