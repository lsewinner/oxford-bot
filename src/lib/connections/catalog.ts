import { z } from 'zod';
export const providerId = z.enum(['github','google_mail','microsoft_outlook','google_drive','google_calendar','slack','cloudflare','microsoft_teams','supabase','notion','yuque','feishu']);
export type ProviderId = z.infer<typeof providerId>;
export const PROVIDERS = {
 github: { name:'GitHub', scopes:['read:user','repo'], setup:'https://github.com/settings/developers', operations:['repos','issues','pulls','read_file','create_issue','write_file'] },
 google_mail: { name:'Gmail', scopes:['https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.compose','https://www.googleapis.com/auth/gmail.send'], setup:'https://console.cloud.google.com/apis/credentials', operations:['search','read','draft','send'] },
 microsoft_outlook: { name:'Outlook', scopes:['openid','profile','email','offline_access','User.Read','Mail.Read','Mail.ReadWrite','Mail.Send'], setup:'https://entra.microsoft.com/', operations:['search','read','draft','send'] },
 microsoft_teams: { name:'Teams', scopes:['openid','profile','email','offline_access','User.Read','Team.ReadBasic.All','Channel.ReadBasic.All','ChannelMessage.Read.All','ChannelMessage.Send'], setup:'https://entra.microsoft.com/', operations:['teams','channels','messages','send'] },
 google_drive: { name:'Google Drive', scopes:['https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/drive.readonly','https://www.googleapis.com/auth/drive.file'], setup:'https://console.cloud.google.com/apis/credentials', operations:['search','read','create_file'] },
 google_calendar: { name:'Google Calendar', scopes:['https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/calendar.readonly','https://www.googleapis.com/auth/calendar.events'], setup:'https://console.cloud.google.com/apis/credentials', operations:['calendars','events','create_event'] },
 cloudflare: { name:'Cloudflare', scopes:[], setup:'https://dash.cloudflare.com/profile/api-tokens', operations:['zones','dns_records'] },
 supabase: { name:'Supabase', scopes:[], setup:'https://supabase.com/dashboard/account/tokens', operations:['projects','tables','query','health'] },
 notion: { name:'Notion', scopes:[], setup:'https://www.notion.so/profile/integrations', operations:['search','read','query','append','create_page'] },
  feishu: { name:'飞书', scopes:[], setup:'https://open.feishu.cn/app', operations:['wiki_spaces','wiki_nodes','read_doc','bitable_tables','bitable_records','add_record'] },
  yuque: { name:'语雀', scopes:[], setup:'https://www.yuque.com/settings/tokens', operations:['repos','docs','read','create_doc','update_doc'] },
 slack: { name:'Slack', scopes:['channels:read','channels:history','chat:write','users:read'], setup:'https://api.slack.com/apps', operations:['channels','history','send'] },
} as const;
export const operationInput = z.object({ operation:z.string(), offset:z.number().int().min(0).max(100000).optional(), account:z.string().max(320).optional(), teamId:z.string().uuid().optional(), channelId:z.string().min(1).max(500).regex(/^[\w:@.-]+$/).optional(), query:z.string().max(8000).optional(), id:z.string().max(500).optional(), repo:z.string().max(200).optional(), path:z.string().max(500).optional(), title:z.string().max(300).optional(), text:z.string().max(30000).optional(), to:z.string().email().optional(), sha:z.string().max(100).optional(), start:z.string().max(40).optional(), end:z.string().max(40).optional(), timeZone:z.string().max(60).regex(/^[\w/+-]+$/).optional() }).strict();
export type OperationInput = z.infer<typeof operationInput>;
export function isWrite(operation:string) { return ['draft','send','create_issue','write_file','create_file','append','create_page','create_doc','update_doc','add_record','create_event'].includes(operation); }
export function validateOperation(provider:ProviderId,input:OperationInput) {
 if (!(PROVIDERS[provider].operations as readonly string[]).includes(input.operation)) throw new Error('不支持的操作');
  if (provider==='feishu') {
   const t=/^\w{6,64}$/;
   if (input.operation!=='wiki_spaces' && !t.test(input.repo ?? '')) throw new Error(input.operation==='read_doc'?'请指定飞书文档 document_id':'请指定飞书知识空间 space_id 或多维表格 app_token');
   if (input.operation==='wiki_nodes' && input.query && !t.test(input.query)) throw new Error('父节点 token 格式无效');
   if (['bitable_records','add_record'].includes(input.operation) && !t.test(input.id ?? '')) throw new Error('请指定多维表格 table_id（来自数据表列表）');
   if (input.operation==='add_record') { let f:unknown; try { f=JSON.parse(input.text ?? ''); } catch { f=null; } if (!f || typeof f!=='object' || Array.isArray(f)) throw new Error('请在 text 中提供记录字段 JSON 对象'); }
  }
  if (provider==='yuque') {
   if (input.operation==='repos' && input.query && !/^[\w-]+$/.test(input.query)) throw new Error('请指定语雀用户或团队 login');
   if (input.operation!=='repos' && !/^[\w-]+\/[\w-]+$/.test(input.repo ?? '')) throw new Error('请指定语雀知识库 namespace（来自知识库列表）');
   if (['read','update_doc'].includes(input.operation) && !/^[\w-]+$/.test(input.id ?? '')) throw new Error('请指定文档 ID 或 slug（来自文档列表）');
   if (['create_doc','update_doc'].includes(input.operation) && (!input.title?.trim() || !input.text?.trim())) throw new Error('请提供文档标题和完整正文');
  }
 if (provider==='google_calendar') {
  if (input.id && !/^[\w.@#-]{1,200}$/.test(input.id)) throw new Error('日历标识格式无效');
  const ok=(v?:string)=>Boolean(v && (/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isNaN(Date.parse(v))));
  if (input.operation==='events' && ((input.start && !ok(input.start)) || (input.end && !ok(input.end)))) throw new Error('时间范围格式无效');
  if (input.operation==='create_event') {
   if (!input.title?.trim()) throw new Error('请提供日程标题');
   if (!ok(input.start) || !ok(input.end)) throw new Error('请提供开始和结束时间（ISO 格式，如 2026-10-22T14:00:00+08:00，全天日程用 YYYY-MM-DD）');
   const allDay=/^\d{4}-\d{2}-\d{2}$/;
   if (allDay.test(input.start!)!==allDay.test(input.end!)) throw new Error('开始和结束时间格式需一致');
   if (Date.parse(input.end!)<=Date.parse(input.start!)) throw new Error('结束时间必须晚于开始时间');
  }
 }
 if (provider==='github' && input.operation!=='repos' && !/^[\w.-]+\/[\w.-]+$/.test(input.repo ?? '')) throw new Error('请指定 owner/repo');
 if (provider==='cloudflare' && input.operation==='dns_records' && !input.id && !input.query) throw new Error('请指定 Zone 标识或域名');
 if (provider==='supabase' && input.operation!=='projects' && !/^[a-z0-9]{20}$/.test(input.id ?? '')) throw new Error('请指定 Supabase 项目 ref（20 位）');
 if (provider==='supabase' && input.operation==='query' && !/^\s*(select|with|explain|show)\b/i.test(input.query ?? '')) throw new Error('只支持只读查询（SELECT / WITH / EXPLAIN / SHOW）');
 if (provider==='notion' && ['read','query','append','create_page'].includes(input.operation) && !/^[a-f0-9]{8}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{4}-?[a-f0-9]{12}$/i.test(input.id ?? '')) throw new Error('请指定 Notion 页面或数据库 ID（来自搜索结果）');
 if (provider==='notion' && input.operation==='append' && !input.text?.trim()) throw new Error('请提供要追加的内容');
 if (provider==='notion' && input.operation==='create_page' && (!input.title?.trim() || !input.text?.trim())) throw new Error('请提供页面标题和内容');
 if (['read','history'].includes(input.operation) && !input.id) throw new Error('缺少文件、邮件或频道标识');
 if (provider==='microsoft_teams') {
  operationInput.parse(input);
  if (input.operation!=='teams' && !input.teamId) throw new Error('请指定团队标识 teamId');
  if (['messages','send'].includes(input.operation) && !input.channelId) throw new Error('请指定频道标识 channelId');
  if (input.operation==='send' && !input.text?.trim()) throw new Error('请提供消息正文');
 }
 if (['draft','send'].includes(input.operation) && provider!=='slack' && provider!=='microsoft_teams' && (!input.to || !input.title || !input.text)) throw new Error('请提供收件人、主题和正文');
 if (provider==='slack' && input.operation==='send' && (!input.id || !input.text)) throw new Error('请指定频道和消息');
 if (['create_issue','create_file'].includes(input.operation) && (!input.title || !input.text)) throw new Error('请提供标题和内容');
 if (['read_file','write_file'].includes(input.operation) && (!input.path || input.path.split('/').includes('..'))) throw new Error('请指定有效文件路径');
 if (input.operation==='write_file' && (!input.text || !input.title)) throw new Error('请提供文件内容和提交说明');
 return input;
}
export type ToolResult = { provider:string; status:'completed'|'confirmation_required'|'reconnect_required'|'error'|'cancelled'; summary:string; actionId?:string; items?:{ title:string; detail?:string; id?:string; url?:string }[]; text?:string };
