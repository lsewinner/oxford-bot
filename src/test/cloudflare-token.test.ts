import { afterEach, describe, expect, it, vi } from 'vitest';
import { callWithPersonalToken, validatePersonalToken } from '@/lib/connections/personal-token.server';
import { validateOperation } from '@/lib/connections/catalog';
describe('Cloudflare personal API token', () => {
 afterEach(()=>vi.unstubAllGlobals());
 it('validates against the fixed Cloudflare v4 host without following redirects',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({success:true,result:[]}));vi.stubGlobal('fetch',fetcher);
  await validatePersonalToken('cloudflare','test-only-credential');
  expect(fetcher.mock.calls[0]?.[0]).toBe('https://api.cloudflare.com/client/v4/zones?per_page=1');
  expect(fetcher.mock.calls[0]?.[1].redirect).toBe('manual');
 });
 it('rejects a token Cloudflare reports as unsuccessful',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({success:false,errors:[{message:'Invalid API Token'}]},{status:400})));
  await expect(validatePersonalToken('cloudflare','test-only-credential')).rejects.toThrow('Cloudflare Token 已失效');
 });
 it('only allows reading zones and DNS records',async()=>{
  const fetcher=vi.fn().mockResolvedValue(Response.json({success:true,result:[]}));vi.stubGlobal('fetch',fetcher);
  await callWithPersonalToken('cloudflare','t','/zones/0123456789abcdef0123456789abcdef/dns_records?per_page=100');
  for(const path of ['/user/tokens','/accounts/x/workers/scripts','/zones/0123456789abcdef0123456789abcdef/settings','/zones/../user'])await expect(callWithPersonalToken('cloudflare','t',path)).rejects.toThrow('不支持');
  await expect(callWithPersonalToken('cloudflare','t','/zones/0123456789abcdef0123456789abcdef/dns_records',{method:'POST'})).rejects.toThrow('不支持');
  expect(fetcher).toHaveBeenCalledTimes(1);
 });
 it('requires a zone id or domain to list DNS records',()=>{
  expect(()=>validateOperation('cloudflare',{operation:'dns_records'})).toThrow('Zone');
  expect(()=>validateOperation('cloudflare',{operation:'purge_cache'})).toThrow('不支持');
 });
});
