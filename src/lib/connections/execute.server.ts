import { callAsAppUser,appUserReconnectRequired } from '@/integrations/lovable/appUserConnector';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { decryptConnectionKey,getConnection,rotateMicrosoftCredential } from './storage.server';
import { PROVIDERS,validateOperation,isWrite,type ProviderId,type OperationInput,type ToolResult } from './catalog';
import { callWithPersonalToken,supportsPersonalToken,personalTokenError } from './personal-token.server';
import { callWithMicrosoftToken,MicrosoftReconnectError } from './microsoft-oauth.server';
import { callWithGoogleToken,isGoogleProvider } from './google-oauth.server';
const BASE='https://connector-gateway.lovable.dev';
const enc=encodeURIComponent;
const b64=(s:string)=>Buffer.from(s,'utf8').toString('base64');
export async function executeOperation(userId:string,id:ProviderId,input:OperationInput,confirmed=false):Promise<ToolResult> {
 validateOperation(id,input);const provider=PROVIDERS[id].name;
 const row=input.account?await getConnection(userId,id,input.account):await getConnection(userId,id);
 if(input.account && !row) return {provider,status:'error',summary:`未找到已连接的账户 ${input.account}`};
 if(!row || !row.enabled) return {provider,status:'error',summary:'请先在工具与连接中心授权并启用此服务'};
 if(row.reconnect_required)return {provider,status:'reconnect_required',summary:'授权需要更新，请重新连接'};
 if(isWrite(input.operation) && !confirmed){
 const {data,error}=await supabaseAdmin.from('tool_actions').insert({user_id:userId,connector_id:id,operation:input.operation,payload:row.account_key && !input.account?{...input,account:row.account_key}:input}).select('id').single();
 if(error || !data)throw new Error('无法保存待确认操作');
 return {provider,status:'confirmation_required',actionId:data.id,summary:`${provider} · ${input.operation} · ${row.account_label || row.account_key || ''} · ${input.teamId ? `${input.teamId} / ${input.channelId ?? ''}` : input.to ?? input.repo ?? input.id ?? input.title ?? ''}${input.start?` · ${input.start} → ${input.end ?? ''}`:''}`,...(input.text?{text:input.text}:{})};
 }
 const request=async(path:string,method='GET',body?:unknown,raw=false)=>{
 const init={method,headers:{Accept:id==='github'?'application/vnd.github+json':'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})};
 const personal=row.credential_kind==='personal_token';
 const google=row.credential_kind==='google_oauth';
 const microsoft=row.credential_kind==='microsoft_oauth';
 if(microsoft && id!=='microsoft_outlook' && id!=='microsoft_teams' && id!=='microsoft_calendar')throw new Error('此服务不支持微软授权');
 if(personal && !supportsPersonalToken(id))throw new Error('不支持此服务的个人 Token');
 if(google && !isGoogleProvider(id))throw new Error('此服务不支持 Google 授权');
 let r:Response;
  try{r=microsoft?await callWithMicrosoftToken(decryptConnectionKey(row.connection_key_ciphertext,'microsoft_oauth'),path,init,token=>rotateMicrosoftCredential(userId,row.id,row.connection_key_ciphertext,token),id==='microsoft_teams'?'microsoft_teams':id==='microsoft_calendar'?'microsoft_calendar':'microsoft_outlook'):personal && supportsPersonalToken(id)?await callWithPersonalToken(id,decryptConnectionKey(row.connection_key_ciphertext,'personal_token'),path,init):google && isGoogleProvider(id)?await callWithGoogleToken(id,decryptConnectionKey(row.connection_key_ciphertext),path,init):await callAsAppUser({gatewayBaseUrl:BASE,connectionAPIKey:decryptConnectionKey(row.connection_key_ciphertext),connectorId:id,path,requiredScopes:PROVIDERS[id].scopes,init});}catch(e){if(e instanceof MicrosoftReconnectError){await supabaseAdmin.from('app_user_connections').update({reconnect_required:true}).eq('id',row.id).eq('user_id',userId);return Promise.reject(e);}throw e;}
 if(microsoft && r.status===401){await supabaseAdmin.from('app_user_connections').update({reconnect_required:true}).eq('id',row.id).eq('user_id',userId);throw new MicrosoftReconnectError();}
 if(google && isGoogleProvider(id)){
   if(!r.ok){if(r.status===401){await supabaseAdmin.from('app_user_connections').update({reconnect_required:true}).eq('id',row.id).eq('user_id',userId);throw new Error('授权需要更新，请重新连接');}throw new Error(`${provider} (${r.status})`);}
   const b=raw?await r.text():(r.status===204 || (microsoft && method==='POST' && path==='/me/sendMail'))?{}:await r.json();return b;
  }
 if(personal && supportsPersonalToken(id)){
   if(!r.ok)throw new Error(personalTokenError(id,r.status));
   const b=await r.json().catch(()=>null);
   if(!b)throw new Error('服务返回格式错误');
   if(id==='cloudflare' && b.success!==true)throw new Error(`Cloudflare: ${b.errors?.[0]?.message ?? '请求失败'}`);
   if(id==='feishu' && b.code!==0)throw new Error(`飞书：${b.msg ?? '请求失败'}（请确认应用已开通权限，且文档/知识库/表格已添加该应用）`);
   if(id==='slack' && b.ok!==true)throw new Error(personalTokenError(id,r.status,b.error));
   return b;
 }
 if(await appUserReconnectRequired(r)){await supabaseAdmin.from('app_user_connections').update({reconnect_required:true}).eq('id',row.id).eq('user_id',userId);throw new Error('授权需要更新，请重新连接');}
 if(!r.ok){const text=await r.text();console.error(`Provider ${id} failed [${r.status}]: ${text}`);throw new Error(`${provider} (${r.status}): ${text.slice(0,1200)}`);}
 const b=raw?await r.text():(r.status===204 || (microsoft && method==='POST' && path==='/me/sendMail'))?{}:await r.json();if(!raw && b.ok===false)throw new Error(`${provider}: ${b.error}`);return b;
 };
 const o=input.operation;let items:NonNullable<ToolResult['items']>=[],text:string|undefined;
 if(id==='github'){
 const repo=(input.repo ?? '').split('/').map(enc).join('/');const path=(input.path ?? '').split('/').map(enc).join('/');
 if(o==='repos'){const b=await request('/user/repos?per_page=20&sort=updated');items=b.map((v:any)=>({title:v.full_name,id:v.full_name,url:v.html_url,detail:v.description ?? ''}));}
 if(o==='issues'){const b=await request(`/repos/${repo}/issues?state=open&per_page=20`);items=b.map((v:any)=>({title:v.title,id:String(v.number),url:v.html_url,detail:(v.body ?? '').slice(0,2000)}));}
 if(o==='pulls'){const b=await request(`/repos/${repo}/pulls?state=open&per_page=20`);items=b.map((v:any)=>({title:v.title,id:String(v.number),url:v.html_url,detail:(v.body ?? '').slice(0,2000)}));}
 if(o==='read_file'){const b=await request(`/repos/${repo}/contents/${path}`);if(b.encoding!=='base64')throw new Error('请选择一个文本文件');text=Buffer.from(b.content,'base64').toString('utf8').slice(0,30000);items=[{title:b.path,id:b.sha,url:b.html_url}];}
 if(o==='create_issue'){const b=await request(`/repos/${repo}/issues`,'POST',{title:input.title,body:input.text});items=[{title:b.title,id:String(b.number),url:b.html_url}];}
 if(o==='write_file'){const b=await request(`/repos/${repo}/contents/${path}`,'PUT',{message:input.title,content:b64(input.text ?? ''),...(input.sha?{sha:input.sha}:{})});items=[{title:input.path ?? '',url:b.content?.html_url}];}
 } else if(id==='google_mail'){
 if(o==='search'){const b=await request(`/gmail/v1/users/me/messages?maxResults=10&q=${enc(input.query ?? '')}`);items=(b.messages ?? []).map((v:any)=>({title:'邮件',id:v.id,detail:'使用邮件标识读取正文'}));}
 if(o==='read'){const b=await request(`/gmail/v1/users/me/messages/${enc(input.id ?? '')}?format=full`);const h=b.payload?.headers ?? [];const subject=h.find((v:any)=>v.name.toLowerCase()==='subject')?.value ?? '邮件';const from=h.find((v:any)=>v.name.toLowerCase()==='from')?.value ?? '';const texts:string[]=[];const walk=(p:any)=>{if(p.mimeType==='text/plain' && p.body?.data)texts.push(Buffer.from(p.body.data,'base64url').toString('utf8'));for(const c of p.parts ?? [])walk(c);};walk(b.payload ?? {});text=(texts.join('\n') || b.snippet || '').slice(0,30000);items=[{title:subject,detail:from,id:b.id}];}
 if(o==='draft' || o==='send'){const subject=`=?UTF-8?B?${b64(input.title ?? '')}?=`;const raw=Buffer.from([`To: ${input.to}`,`Subject: ${subject}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','',input.text].join('\r\n'),'utf8').toString('base64url');const b=await request(o==='draft'?'/gmail/v1/users/me/drafts':'/gmail/v1/users/me/messages/send','POST',o==='draft'?{message:{raw}}:{raw});items=[{title:input.title ?? '',id:b.id}];}
 } else if(id==='microsoft_outlook'){
 if(o==='search'){const b=await request(`/me/messages?$top=10&$select=id,subject,from,bodyPreview${input.query?'&$search='+enc('"'+input.query.replace(/"/g,'')+'"'):''}`);items=(b.value ?? []).map((v:any)=>({title:v.subject,id:v.id,detail:v.bodyPreview}));}
 if(o==='read'){const b=await request(`/me/messages/${enc(input.id ?? '')}?$select=id,subject,body,from`);items=[{title:b.subject,id:b.id,detail:b.from?.emailAddress?.address}];text=String(b.body?.content ?? '').slice(0,30000);}
 if(o==='draft' || o==='send'){const message={subject:input.title,body:{contentType:'Text',content:input.text},toRecipients:[{emailAddress:{address:input.to}}]};if(o==='send'){await request('/me/sendMail','POST',{message});}else{const b=await request('/me/messages','POST',message);items=[{title:b.subject,id:b.id}];}}
 } else if(id==='microsoft_teams'){
  const base=`/teams/${enc(input.teamId ?? '')}/channels`;
  const messages=`${base}/${enc(input.channelId ?? '')}/messages`;
  if(o==='teams' || o==='channels'){
   const b=await request(o==='teams'?'/me/joinedTeams':base);
   items=(b.value ?? []).map((v:any)=>({title:v.displayName ?? '未命名',id:v.id,detail:v.description ?? '',...(v.webUrl?{url:v.webUrl}:{})}));
   if(b['@odata.nextLink'])text='当前显示一页结果';
  }
  if(o==='messages'){
   const b=await request(`${messages}?$top=20`);
   items=(b.value ?? []).map((v:any)=>({title:v.from?.user?.displayName || v.from?.application?.displayName || '系统消息',id:v.id,detail:`${v.createdDateTime ?? ''}\n${String(v.body?.content ?? '').slice(0,3000)}`,...(v.webUrl?{url:v.webUrl}:{})}));
   if(b['@odata.nextLink'])text='仅显示当前 20 条频道消息';
  }
  if(o==='send'){
   const b=await request(messages,'POST',{body:{contentType:'text',content:input.text}});
   items=[{title:input.text?.slice(0,100) ?? '消息',id:b.id,...(b.webUrl?{url:b.webUrl}:{})}];
  }
 } else if(id==='microsoft_calendar'){
 const zone=(v?:string)=>v && /^[\w/+-]+$/.test(v) ? v : undefined;
 const dt=(v:any)=>`${v?.dateTime ?? v?.date ?? ''}${v?.date?'（全天）':''}`;
 const toIso=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)?`${v}T00:00:00Z`:new Date(v).toISOString();
 if(o==='calendars'){const b=await request('/me/calendars?$top=50');items=(b.value ?? []).map((v:any)=>({title:v.name ?? '未命名',id:v.id,detail:v.isDefaultCalendar?'默认日历':''}));if(b.value?.length>=50)text='仅显示前 50 个日历';}
 if(o==='events'){const start=input.start?toIso(input.start):new Date().toISOString();const end=input.end?toIso(input.end):new Date(Date.parse(start)+14*86400000).toISOString();const p=new URLSearchParams({startDateTime:start,endDateTime:end,'$top':'50','\$orderby':'start/dateTime'});const b=await request(`/me/calendarView?${p}`);items=(b.value ?? []).map((v:any)=>({title:v.subject ?? '（无标题）',id:v.id,url:v.webLink,detail:`${dt(v.start)} → ${dt(v.end)}${v.location?.displayName?` · ${v.location.displayName}`:''}${v.isAllDay?' · 全天':''}`}));if(b.value?.length>=50)text='仅显示前 50 条日程';}
 if(o==='create_event'){const allDay=/^\d{4}-\d{2}-\d{2}$/.test(input.start ?? '');const t=(v:string)=>allDay?{date:v}:{dateTime:v,...(zone(input.timeZone)?{timeZone:input.timeZone}:{})};const b=await request('/me/events','POST',{subject:input.title,...(input.text?{body:{contentType:'text',content:input.text}}:{}),isAllDay:allDay,start:t(input.start!),end:t(input.end!)});items=[{title:b.subject ?? input.title ?? '',id:b.id,...(b.webLink?{url:b.webLink}:{}),detail:`${dt(b.start)} → ${dt(b.end)}`}];}
 } else if(id==='google_calendar'){
 const cal=enc(input.id || 'primary');
 const when=(v:any)=>v?.dateTime ?? v?.date ?? '';
 if(o==='calendars'){const b=await request('/calendar/v3/users/me/calendarList?maxResults=50');items=(b.items ?? []).map((v:any)=>({title:v.summary,id:v.id,detail:`${v.primary?'主日历 · ':''}${v.accessRole ?? ''} · ${v.timeZone ?? ''}`}));}
 if(o==='events'){const toIso=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)?`${v}T00:00:00Z`:new Date(v).toISOString();const min=input.start?toIso(input.start):new Date().toISOString();const max=input.end?toIso(input.end):new Date(Date.parse(min)+14*86400000).toISOString();const p=new URLSearchParams({singleEvents:'true',orderBy:'startTime',maxResults:'50',timeMin:min,timeMax:max});if(input.query)p.set('q',input.query);if(input.timeZone)p.set('timeZone',input.timeZone);const b=await request(`/calendar/v3/calendars/${cal}/events?${p}`);items=(b.items ?? []).map((v:any)=>({title:v.summary ?? '（无标题）',id:v.id,url:v.htmlLink,detail:`${when(v.start)} → ${when(v.end)}${v.start?.date?'（全天，结束日期不含当天）':''}${v.location?` · ${v.location}`:''}`}));}
 if(o==='create_event'){const allDay=/^\d{4}-\d{2}-\d{2}$/.test(input.start ?? '');const t=(v:string)=>allDay?{date:v}:{dateTime:v,...(input.timeZone?{timeZone:input.timeZone}:{})};const b=await request(`/calendar/v3/calendars/${cal}/events`,'POST',{summary:input.title,...(input.text?{description:input.text}:{}),start:t(input.start!),end:t(input.end!)});items=[{title:b.summary,id:b.id,url:b.htmlLink,detail:`${when(b.start)} → ${when(b.end)}`}];}
 } else if(id==='google_drive'){
 const esc=(v:string)=>v.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
 const kind=(mt?:string)=>{const m=String(mt ?? '');return m==='application/vnd.google-apps.folder'?'文件夹':m==='application/vnd.google-apps.document'?'文档':m==='application/vnd.google-apps.spreadsheet'?'表格':m==='application/vnd.google-apps.presentation'?'幻灯片':m==='application/vnd.google-apps.form'?'表单':m==='application/pdf'?'PDF':m.startsWith('image/')?'图片':m.startsWith('video/')?'视频':m.startsWith('audio/')?'音频':m==='application/zip'?'压缩包':m.startsWith('text/')||m==='application/json'?'文本':(m.split('/').pop() ?? '文件');};
 const day=(v?:string)=>String(v ?? '').slice(0,10);
 const brief=(v:any)=>({title:v.name,id:v.id,url:v.webViewLink,detail:`${kind(v.mimeType)}${v.modifiedTime?' · 修改 '+day(v.modifiedTime):''}`});
 if(o==='folders'){const parent=/^[\w-]{1,64}$/.test(input.id ?? '')?input.id!:'root';const b=await request(`/drive/v3/files?pageSize=50&orderBy=${enc('folder,name')}&fields=files(id,name,mimeType,webViewLink,modifiedTime)&q=${enc(`'${parent}' in parents and trashed = false`)}`);items=(b.files ?? []).map(brief);if((b.files ?? []).length>=50)text='仅显示前 50 项，可换用搜索缩小范围';}
 if(o==='search'){const t=(input.query ?? '').trim();if(!t)throw new Error('请提供要搜索的文件名或正文关键词');const q=`trashed = false and (name contains '${esc(t)}' or fullText contains '${esc(t)}')`;const b=await request(`/drive/v3/files?pageSize=20&orderBy=${enc('modifiedTime desc')}&fields=files(id,name,mimeType,webViewLink,modifiedTime)&q=${enc(q)}`);items=(b.files ?? []).map(brief);if((b.files ?? []).length>=20)text='仅显示前 20 条结果，可换关键词或进入文件夹查看';}
 if(o==='read'){const file=enc(input.id ?? '');const b=await request(`/drive/v3/files/${file}?fields=id,name,mimeType,size`);if(Number(b.size)>1000000)throw new Error('文件过大，请上传附件进行分析');const out=(mime:string)=>request(`/drive/v3/files/${file}/export?mimeType=${enc(mime)}`,'GET',undefined,true);
  if(b.mimeType==='application/vnd.google-apps.document')text=await out('text/plain');else if(b.mimeType==='application/vnd.google-apps.spreadsheet')text=await out('text/csv');else if(b.mimeType==='application/vnd.google-apps.presentation')text=await out('text/plain');else if(String(b.mimeType).startsWith('text/')||b.mimeType==='application/json')text=await request(`/drive/v3/files/${file}?alt=media`,'GET',undefined,true);else throw new Error('此类型暂不能直接读取，请下载后作为附件上传到对话');
  text=text?.slice(0,30000);items=[{title:b.name,id:b.id,detail:kind(b.mimeType)}];}
 if(o==='create_file'){const b=await request('/drive/v3/files','POST',{name:input.title,mimeType:'text/plain'});const uploadInit={method:'PATCH',headers:{'Content-Type':'text/plain; charset=utf-8'},body:input.text ?? ''};const upload=row.credential_kind==='google_oauth'?await callWithGoogleToken('google_drive',decryptConnectionKey(row.connection_key_ciphertext),`/upload/drive/v3/files/${enc(b.id)}?uploadType=media`,uploadInit):await callAsAppUser({gatewayBaseUrl:BASE,connectionAPIKey:decryptConnectionKey(row.connection_key_ciphertext),connectorId:id,path:`/upload/drive/v3/files/${enc(b.id)}?uploadType=media`,requiredScopes:PROVIDERS[id].scopes,init:uploadInit});if(!upload.ok)throw new Error(`Drive 文件内容上传失败 (${upload.status}): ${(await upload.text()).slice(0,1200)}`);items=[{title:input.title ?? '',id:b.id}];}
 } else if(id==='cloudflare'){
 if(o==='zones'){const b=await request(`/zones?per_page=50${input.query?'&name='+enc(input.query.trim().toLowerCase()):''}`);items=(b.result ?? []).map((v:any)=>({title:v.name,id:v.id,detail:`${v.status ?? ''}${v.plan?.name?' · '+v.plan.name:''}${v.name_servers?.length?' · NS '+v.name_servers.join(', '):''}`}));if((b.result_info?.total_count ?? 0)>50)text='仅显示前 50 个 Zone';}
 if(o==='dns_records'){let zone=(input.id ?? '').trim().toLowerCase();if(!/^[a-f0-9]{32}$/.test(zone)){const name=zone || (input.query ?? '').trim().toLowerCase();const z=await request(`/zones?per_page=1&name=${enc(name)}`);zone=z.result?.[0]?.id ?? '';if(!zone)throw new Error(`未找到 Zone：${name}，请确认 Token 有该域名的 Zone Read 权限`);}
  const b=await request(`/zones/${zone}/dns_records?per_page=100`);items=(b.result ?? []).map((v:any)=>({title:`${v.type} ${v.name}`,id:v.id,detail:`${v.content}${v.proxied?' · 已代理':''} · TTL ${v.ttl===1?'自动':v.ttl}`}));if((b.result_info?.total_count ?? 0)>100)text='仅显示前 100 条记录';}
 } else if(id==='feishu'){
 const r=input.repo ?? '';const more=(b:any,n:string)=>{if(b.data?.has_more)text=`仅显示前 50 ${n}`;};
 if(o==='wiki_spaces'){const b=await request('/wiki/v2/spaces?page_size=50');items=(b.data?.items ?? []).map((v:any)=>({title:v.name || '未命名空间',id:v.space_id,detail:v.description ?? ''}));more(b,'个知识空间');}
 if(o==='wiki_nodes'){const b=await request(`/wiki/v2/spaces/${r}/nodes?page_size=50${input.query?'&parent_node_token='+input.query:''}`);items=(b.data?.items ?? []).map((v:any)=>({title:v.title || '未命名',id:v.obj_token,detail:`${v.obj_type ?? ''}${v.has_child?' · 有子节点 node_token='+v.node_token:''}`}));more(b,'个节点');}
 if(o==='read_doc'){const b=await request(`/docx/v1/documents/${r}/raw_content`);const c=String(b.data?.content ?? '');text=c.slice(0,30000)+(c.length>30000?'\n[正文超过长度限制，已截断]':'');items=[{title:'飞书文档',id:r,url:`https://feishu.cn/docx/${r}`}];}
 if(o==='bitable_tables'){const b=await request(`/bitable/v1/apps/${r}/tables?page_size=50`);items=(b.data?.items ?? []).map((v:any)=>({title:v.name,id:v.table_id}));more(b,'张数据表');}
 if(o==='bitable_records'){const b=await request(`/bitable/v1/apps/${r}/tables/${input.id}/records?page_size=50`);items=(b.data?.items ?? []).map((v:any)=>({title:v.record_id,id:v.record_id,detail:Object.entries(v.fields ?? {}).map(([k,x]:any)=>`${k}: ${typeof x==='object'?JSON.stringify(x):String(x)}`).join(' · ').slice(0,1500)}));more(b,'条记录');}
 if(o==='add_record'){const b=await request(`/bitable/v1/apps/${r}/tables/${input.id}/records`,'POST',{fields:JSON.parse(input.text ?? '{}')});items=[{title:'已新增记录',id:b.data?.record?.record_id}];}
 } else if(id==='yuque'){
 const namespace=input.repo ?? '';const base=`/repos/${namespace}/docs`;const offset=input.offset ?? 0;
 const docItem=(v:any)=>({title:v.title || '未命名',id:String(v.id ?? v.slug),url:`https://www.yuque.com/${namespace}/${enc(v.slug ?? String(v.id))}`,detail:v.description ?? v.updated_at ?? ''});
 if(o==='repos'){
  const user=await request('/user');const login=input.query || user.data?.login;
  if(!login || !/^[\w-]+$/.test(login))throw new Error('无法识别语雀用户或团队');
  const b=await request(`/users/${login}/repos?offset=${offset}&limit=50`);
  if(!Array.isArray(b.data))throw new Error('语雀知识库返回格式错误');
  items=b.data.map((v:any)=>({title:v.name,id:v.namespace,url:`https://www.yuque.com/${v.namespace}`,detail:v.description ?? ''}));
  if(b.data.length===50)text=`当前页 50 个知识库；继续查询请使用 offset=${offset+50}`;
 }
 if(o==='docs'){
  const b=await request(`${base}?offset=${offset}&limit=50`);
  if(!Array.isArray(b.data))throw new Error('语雀文档列表返回格式错误');
  items=b.data.map(docItem);if(b.data.length===50)text=`当前页 50 篇文档；继续查询请使用 offset=${offset+50}`;
 }
 if(o==='read'){
  const b=await request(`${base}/${enc(input.id ?? '')}`);if(!b.data?.id)throw new Error('语雀文档返回格式错误');
  const content=b.data.body ?? b.data.body_draft ?? '';text=String(content).slice(0,30000);items=[docItem(b.data)];
  if(String(content).length>30000)text+='\n[正文超过长度限制，已截断]';
 }
 if(o==='create_doc' || o==='update_doc'){
  let visibility=0;
  if(o==='update_doc'){
   const previous=await request(`${base}/${enc(input.id ?? '')}`);
   if(![0,1,2].includes(previous.data?.public))throw new Error('无法确认原文档可见性，未更新');
   visibility=previous.data.public;
  }
  const b=await request(o==='create_doc'?base:`${base}/${enc(input.id ?? '')}`,o==='create_doc'?'POST':'PUT',{title:input.title,body:input.text,format:'markdown',public:visibility});
  if(!b.data?.id)throw new Error('语雀未返回文档结果，请检查原文档后再操作');items=[docItem(b.data)];
 }
 } else if(id==='notion'){
 const nid=(input.id ?? '').toLowerCase();
 const plain=(rt:any[])=>(rt ?? []).map((t:any)=>t.plain_text ?? '').join('');
 const titleOf=(v:any)=>{if(v.title)return plain(v.title);for(const p of Object.values(v.properties ?? {}) as any[])if(p?.type==='title')return plain(p.title);return '未命名';};
 const paras=(t:string)=>t.split(/\n{2,}/).slice(0,90).map(c=>({object:'block',type:'paragraph',paragraph:{rich_text:[{type:'text',text:{content:c.slice(0,1900)}}]}}));
 if(o==='search'){const b=await request('/search','POST',{query:input.query ?? '',page_size:20});items=(b.results ?? []).map((v:any)=>({title:titleOf(v),id:v.id,url:v.url,detail:v.object==='data_source'||v.object==='database'?'数据库':'页面'}));}
 if(o==='read'){const page=await request(`/pages/${nid}`);const b=await request(`/blocks/${nid}/children?page_size=100`);text=(b.results ?? []).map((v:any)=>{const c=v[v.type];const t=plain(c?.rich_text ?? []);return v.type?.startsWith('heading')?`# ${t}`:v.type==='to_do'?`[${c?.checked?'x':' '}] ${t}`:v.type==='bulleted_list_item'||v.type==='numbered_list_item'?`- ${t}`:t;}).filter(Boolean).join('\n').slice(0,30000);items=[{title:titleOf(page),id:page.id,url:page.url}];}
 if(o==='query'){let ds=nid;try{const db=await request(`/databases/${nid}`);ds=db.data_sources?.[0]?.id ?? nid;}catch{}const b=await request(`/data_sources/${ds}/query`,'POST',{page_size:50});items=(b.results ?? []).map((v:any)=>({title:titleOf(v),id:v.id,url:v.url,detail:Object.entries(v.properties ?? {}).filter(([,p]:any)=>p.type!=='title').map(([k,p]:any)=>{const val=p[p.type];const s=Array.isArray(val)?val.map((x:any)=>x.plain_text ?? x.name ?? '').join(','):val?.name ?? val?.start ?? (typeof val==='object'?'':String(val ?? ''));return s?`${k}: ${s}`:'';}).filter(Boolean).join(' · ').slice(0,1500)}));if(b.has_more)text='仅显示前 50 条';}
 if(o==='append'){await request(`/blocks/${nid}/children`,'PATCH',{children:paras(input.text ?? '')});items=[{title:'已追加到页面',id:nid}];}
 if(o==='create_page'){const b=await request('/pages','POST',{parent:{page_id:nid},properties:{title:{title:[{text:{content:input.title}}]}},children:paras(input.text ?? '')});items=[{title:input.title ?? '',id:b.id,url:b.url}];}
 } else if(id==='supabase'){
 const ref=input.id ?? '';
 const sql=async(q:string)=>{const b=await request(`/projects/${ref}/database/query/read-only`,'POST',{query:q});return Array.isArray(b)?b:(b.result ?? b.rows ?? []);};
 if(o==='projects'){const b=await request('/projects');items=(b ?? []).map((v:any)=>({title:v.name,id:v.id ?? v.ref,detail:`${v.region ?? ''} · ${v.status ?? ''}${v.database?.version?' · Postgres '+v.database.version:''}`}));}
 if(o==='tables'){const rows=await sql("select table_schema, table_name, string_agg(column_name||' '||data_type, ', ' order by ordinal_position) as columns from information_schema.columns where table_schema not in ('pg_catalog','information_schema','auth','storage','realtime','supabase_functions','vault','extensions','graphql','graphql_public','pgsodium','net','cron') group by 1,2 order by 1,2 limit 200");items=rows.map((v:any)=>({title:`${v.table_schema}.${v.table_name}`,detail:String(v.columns ?? '').slice(0,2000)}));}
 if(o==='query'){const rows=await sql(input.query ?? '');text=JSON.stringify(rows.slice(0,200),null,1).slice(0,30000);items=[{title:`返回 ${rows.length} 行`,detail:rows.length>200?'仅显示前 200 行':''}];}
 if(o==='health'){const b=await request(`/projects/${ref}/health?services=db,auth,rest,storage,realtime`);items=(b ?? []).map((v:any)=>({title:v.name,detail:`${v.healthy?'正常':'异常'} · ${v.status ?? ''}${v.error?' · '+v.error:''}`}));}
 } else {
 if(o==='channels'){const b=await request('/api/conversations.list?limit=50&exclude_archived=true');items=(b.channels ?? []).map((v:any)=>({title:v.name,id:v.id}));if(b.response_metadata?.next_cursor)text='仅显示前 50 个频道';}
 if(o==='history'){const b=await request(`/api/conversations.history?limit=20&channel=${enc(input.id ?? '')}`);const users=new Map<string,string>();for(const v of b.messages ?? []){if(v.user && !users.has(v.user)){try{const u=await request(`/api/users.info?user=${enc(v.user)}`);users.set(v.user,u.user?.profile?.display_name || u.user?.real_name || u.user?.name || '未知成员');}catch{users.set(v.user,'未知成员');}}}items=(b.messages ?? []).map((v:any)=>({title:users.get(v.user) ?? '系统消息',detail:(v.text ?? '').slice(0,3000)}));}
 if(o==='send'){const b=await request('/api/chat.postMessage','POST',{channel:input.id,text:input.text});items=[{title:input.text?.slice(0,100) ?? '消息',id:b.ts}];}
 }
 return {provider,status:'completed',summary:isWrite(o)?'操作已完成':'读取完成',items,...(text?{text}:{})};
}
