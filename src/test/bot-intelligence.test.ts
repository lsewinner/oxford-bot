import { describe,it,expect } from 'vitest';
import {botConfigSchema,botInstructions,thinkOptions} from '@/lib/bot-config';
import {mergeBotEntries,parseBotEntries} from '@/lib/bot-presence';
import {parseGitHubTrending} from '@/lib/trends.server';
import {trendAnalysisPrompt} from '@/lib/trends';
describe('Bot intelligence rules',()=>{
 it('applies each Bots own persona and tool preference to instructions',()=>{const text=botInstructions({name:'研究猫',kind:'code',systemPrompt:'用中文专注代码审查',preferredTools:['github']});expect(text).toContain('用中文专注代码审查');expect(text).toContain('github');expect(text).toContain('研究猫');});
 it('keeps independent persona preferences after history merging and reload',()=>{const old={id:'a',threadId:'a',messageId:'a',bot:{name:'猫',kind:'code' as const}};const configured={...old,bot:{...old.bot,systemPrompt:'专注审查',preferredTools:['github' as const]}};const saved=parseBotEntries(JSON.stringify(mergeBotEntries([configured],[old])));expect(saved[0]?.bot.systemPrompt).toBe('专注审查');expect(saved[0]?.bot.preferredTools).toEqual(['github']);});
 it('rejects unsupported tool preferences',()=>expect(botConfigSchema.safeParse({name:'猫',kind:'code',preferredTools:['arbitrary_tool']}).success).toBe(false));
 it('only Deep Think reasons; normal replies use no reasoning',()=>{expect(thinkOptions(true).reasoningEffort).toBe('high');expect(thinkOptions(false).reasoningEffort).toBe('none');});
 it('stays stateless in both modes',()=>{for(const mode of [true,false])expect(thinkOptions(mode).store).toBe(false);expect(thinkOptions(true).include).toEqual(['reasoning.encrypted_content']);});
 it('routes normal replies to the fast model and Deep Think to the full model',async()=>{const {chatModelId}=await import('@/lib/ai/provider.server');expect(chatModelId({},false)).toBe('gpt-6-luna');expect(chatModelId({},true)).toBe('gpt-6-sol');});
 it('parses actual Trending repository URLs rather than sponsors or login URLs',()=>{const items=parseGitHubTrending('<article class="Box-row"><a href="/login">Star</a><h2><a href="/owner/repo">owner / repo</a></h2><p>Useful code</p><span class="float-sm-right">100 stars today</span></article>');expect(items[0]?.url).toBe('https://github.com/owner/repo');expect(items[0]?.description).toBe('Useful code');expect(items[0]?.metric).toBe('100 stars today');});
 it('rejects arbitrary external links while parsing repository headings',()=>expect(parseGitHubTrending('<article class="Box-row"><h2><a href="https://evil.example">fake</a></h2></article>')).toEqual([]));
 it('one-click analysis includes original source and asks to verify facts',()=>{const text=trendAnalysisPrompt({id:'a',source:'github',title:'owner/repo',url:'https://github.com/owner/repo',description:'code',metric:'100 stars'});expect(text).toContain('https://github.com/owner/repo');expect(text).toContain('核实最新信息');});
});