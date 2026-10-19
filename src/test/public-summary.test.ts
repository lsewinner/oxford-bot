import {describe,it,expect} from 'vitest';
import {splitPublicSummary} from '@/components/chat/public-summary';
describe('public explanation separation',()=>{
 it('keeps an explanation separate from the final answer',()=>expect(splitPublicSummary('<public_summary>核查依据</public_summary>最终结论')).toEqual({summary:'核查依据',answer:'最终结论',complete:true}));
 it('supports an unfinished streamed explanation',()=>expect(splitPublicSummary('<public_summary>核查中')).toEqual({summary:'核查中',answer:'',complete:false}));
 it('does not relabel ordinary answers as reasoning',()=>expect(splitPublicSummary('普通答案')).toBeNull());
});