import { describe,it,expect } from 'vitest';
import { providerId,isWrite,validateOperation,operationInput } from '@/lib/connections/catalog';
describe('real provider task boundaries',()=>{
 it('supports the five requested personal services',()=>expect(providerId.options).toEqual(['github','google_mail','microsoft_outlook','google_drive','slack','cloudflare']));
 it('requires confirmation for sending mail, drafts and external changes',()=>{for(const op of ['send','draft','write_file','create_issue','create_file'])expect(isWrite(op)).toBe(true);expect(isWrite('search')).toBe(false);});
 it('rejects arbitrary provider operations',()=>expect(()=>validateOperation('github',{operation:'delete_repo',repo:'a/b'})).toThrow());
 it('requires a specific repository before code changes',()=>expect(()=>validateOperation('github',{operation:'write_file',path:'index.html',text:'hello',title:'update'})).toThrow());
 it('requires the recipient and complete mail before sending',()=>expect(()=>validateOperation('google_mail',{operation:'send',text:'hello'})).toThrow());
 it('requires a channel before sending Slack messages',()=>expect(()=>validateOperation('slack',{operation:'send',text:'hello'})).toThrow());
 it('rejects filesystem traversal',()=>expect(()=>validateOperation('github',{operation:'read_file',repo:'a/b',path:'../secrets'})).toThrow());
 it('rejects extra unsafe request fields',()=>expect(()=>operationInput.parse({operation:'search',url:'https://evil.example'})).toThrow());
});