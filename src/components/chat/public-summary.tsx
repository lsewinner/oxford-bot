import { Reasoning,ReasoningContent,ReasoningTrigger } from '@/components/ai-elements/reasoning';
import { MessageResponse } from '@/components/ai-elements/message';
export function splitPublicSummary(text:string){
 const start=text.indexOf('<public_summary>');if(start<0)return null;
 const end=text.indexOf('</public_summary>',start);
 return {summary:text.slice(start+16,end<0?undefined:end).trim(),answer:end<0?'':(text.slice(0,start)+text.slice(end+17)).trim(),complete:end>=0};
}
export function PublicSummary({text,streaming}:{text:string;streaming:boolean}){
 const parsed=splitPublicSummary(text);if(!parsed)return <MessageResponse isAnimating={streaming}>{text}</MessageResponse>;
 return <><Reasoning defaultOpen={false} isStreaming={streaming&&!parsed.complete} className="rounded-lg border border-border bg-card p-3"><ReasoningTrigger getThinkingMessage={active=>active?'正在整理 · 公开论证摘要':'公开论证摘要 · 展开查看依据与核查'}/><ReasoningContent>{parsed.summary}</ReasoningContent></Reasoning>{parsed.answer&&<MessageResponse isAnimating={streaming}>{parsed.answer}</MessageResponse>}</>;
}