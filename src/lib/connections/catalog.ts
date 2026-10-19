import { z } from 'zod';
export const providerId = z.enum(['github','google_mail','microsoft_outlook','google_drive','slack']);
export type ProviderId = z.infer<typeof providerId>;
export const PROVIDERS = {
 github: { name:'GitHub', scopes:['read:user','repo'], setup:'https://github.com/settings/developers', operations:['repos','issues','read_file','create_issue','write_file'] },
 google_mail: { name:'Gmail', scopes:['https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.compose','https://www.googleapis.com/auth/gmail.send'], setup:'https://console.cloud.google.com/apis/credentials', operations:['search','read','draft','send'] },
 microsoft_outlook: { name:'Outlook', scopes:['openid','profile','email','offline_access','User.Read','Mail.Read','Mail.ReadWrite','Mail.Send'], setup:'https://entra.microsoft.com/', operations:['search','read','draft','send'] },
 google_drive: { name:'Google Drive', scopes:['https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/drive.readonly','https://www.googleapis.com/auth/drive.file'], setup:'https://console.cloud.google.com/apis/credentials', operations:['search','read','create_file'] },
 slack: { name:'Slack', scopes:['channels:read','channels:history','chat:write','users:read'], setup:'https://api.slack.com/apps', operations:['channels','history','send'] },
} as const;
export const operationInput = z.object({ operation:z.string(), query:z.string().max(2000).optional(), id:z.string().max(500).optional(), repo:z.string().max(200).optional(), path:z.string().max(500).optional(), title:z.string().max(300).optional(), text:z.string().max(30000).optional(), to:z.string().email().optional(), sha:z.string().max(100).optional() }).strict();
export type OperationInput = z.infer<typeof operationInput>;
export function isWrite(operation:string) { return ['draft','send','create_issue','write_file','create_file'].includes(operation); }
export function validateOperation(provider:ProviderId,input:OperationInput) {
 if (!(PROVIDERS[provider].operations as readonly string[]).includes(input.operation)) throw new Error('不支持的操作');
 if (provider==='github' && input.operation!=='repos' && !/^[\w.-]+\/[\w.-]+$/.test(input.repo ?? '')) throw new Error('请指定 owner/repo');
 if (['read','history'].includes(input.operation) && !input.id) throw new Error('缺少文件、邮件或频道标识');
 if (['draft','send'].includes(input.operation) && provider!=='slack' && (!input.to || !input.title || !input.text)) throw new Error('请提供收件人、主题和正文');
 if (provider==='slack' && input.operation==='send' && (!input.id || !input.text)) throw new Error('请指定频道和消息');
 if (['create_issue','create_file'].includes(input.operation) && (!input.title || !input.text)) throw new Error('请提供标题和内容');
 if (['read_file','write_file'].includes(input.operation) && (!input.path || input.path.split('/').includes('..'))) throw new Error('请指定有效文件路径');
 if (input.operation==='write_file' && (!input.text || !input.title)) throw new Error('请提供文件内容和提交说明');
 return input;
}
export type ToolResult = { provider:string; status:'completed'|'confirmation_required'|'reconnect_required'|'error'|'cancelled'; summary:string; actionId?:string; items?:{ title:string; detail?:string; id?:string; url?:string }[]; text?:string };
