import { callAsAppUser,appUserReconnectRequired } from '@/integrations/lovable/appUserConnector';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { decryptConnectionKey,getConnection } from './storage.server';
import { PROVIDERS,validateOperation,isWrite,type ProviderId,type OperationInput,type ToolResult } from './catalog';
import { callWithPersonalToken,supportsPersonalToken,personalTokenError } from './personal-token.server';
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
 return {provider,status:'confirmation_required',actionId:data.id,summary:`${provider} · ${input.operation} · ${input.to ?? input.repo ?? input.id ?? input.title ?? ''}`,...(input.text?{text:input.text}:{})};
 }
 const request=async(path:string,method='GET',body?:unknown,raw=false)=>{
 const init={method,headers:{Accept:id==='github'?'application/vnd.github+json':'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})};
 const personal=row.credential_kind==='personal_token';
 const google=row.credential_kind==='google_oauth';
 if(personal && !supportsPersonalToken(id))throw new Error('不支持此服务的个人 Token');
 if(google && !isGoogleProvider(id))throw new Error('此服务不支持 Google 授权');
 const r=personal && supportsPersonalToken(id)?await callWithPersonalToken(id,decryptConnectionKey(row.connection_key_ciphertext,'personal_token'),path,init):google && isGoogleProvider(id)?await callWithGoogleToken(id,decryptConnectionKey(row.connection_key_ciphertext),path,init):await callAsAppUser({gatewayBaseUrl:BASE,connectionAPIKey:decryptConnectionKey(row.connection_key_ciphertext),connectorId:id,path,requiredScopes:PROVIDERS[id].scopes,init});
 if(google && isGoogleProvider(id)){
   if(!r.ok){if(r.status===401){await supabaseAdmin.from('app_user_connections').update({reconnect_required:true}).eq('id',row.id).eq('user_id',userId);throw new Error('授权需要更新，请重新连接');}throw new Error(`${provider} (${r.status})`);}
   const b=raw?await r.text():r.status===204?{}:await r.json();return b;
  }
 if(personal && supportsPersonalToken(id)){
   if(!r.ok)throw new Error(personalTokenError(id,r.status));
   const b=await r.json().catch(()=>null);
   if(!b)throw new Error('服务返回格式错误');
   if(id==='slack' && b.ok!==true)throw new Error(personalTokenError(id,r.status,b.error));
   return b;
 }
 if(await appUserReconnectRequired(r)){await supabaseAdmin.from('app_user_connections').update({reconnect_required:true}).eq('id',row.id).eq('user_id',userId);throw new Error('授权需要更新，请重新连接');}
 if(!r.ok){const text=await r.text();console.error(`Provider ${id} failed [${r.status}]: ${text}`);throw new Error(`${provider} (${r.status}): ${text.slice(0,1200)}`);}
 const b=raw?await r.text():r.status===204?{}:await r.json();if(!raw && b.ok===false)throw new Error(`${provider}: ${b.error}`);return b;
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
 if(o==='draft' || o==='send'){const message={subject:input.title,body:{contentType:'Text',content:input.text},toRecipients:[{emailAddress:{address:input.to}}]};if(o==='send'){const r=await callAsAppUser({gatewayBaseUrl:BASE,connectionAPIKey:decryptConnectionKey(row.connection_key_ciphertext),connectorId:id,path:'/me/sendMail',requiredScopes:PROVIDERS[id].scopes,init:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message})}});if(await appUserReconnectRequired(r)){await supabaseAdmin.from('app_user_connections').update({reconnect_required:true}).eq('id',row.id);throw new Error('授权需要更新，请重新连接');}if(!r.ok)throw new Error(`Outlook (${r.status}): ${(await r.text()).slice(0,1200)}`);}else{const b=await request('/me/messages','POST',message);items=[{title:b.subject,id:b.id}];}}
 } else if(id==='google_drive'){
 if(o==='search'){const q=`trashed = false${input.query?" and name contains '"+input.query.replace(/\\/g,'\\\\').replace(/'/g,"\\'")+"'":''}`;const b=await request(`/drive/v3/files?pageSize=20&fields=files(id,name,mimeType,webViewLink)&q=${enc(q)}`);items=(b.files ?? []).map((v:any)=>({title:v.name,id:v.id,url:v.webViewLink,detail:v.mimeType}));}
 if(o==='read'){const file=enc(input.id ?? '');const b=await request(`/drive/v3/files/${file}?fields=id,name,mimeType,size`);if(Number(b.size)>1000000)throw new Error('文件过大，请上传附件进行分析');if(b.mimeType==='application/vnd.google-apps.document')text=await request(`/drive/v3/files/${file}/export?mimeType=text/plain`,'GET',undefined,true);else if(b.mimeType.startsWith('text/') || b.mimeType==='application/json')text=await request(`/drive/v3/files/${file}?alt=media`,'GET',undefined,true);else throw new Error('此类型请下载后上传至对话分析');text=text?.slice(0,30000);items=[{title:b.name,id:b.id}];}
 if(o==='create_file'){const b=await request('/drive/v3/files','POST',{name:input.title,mimeType:'text/plain'});const uploadInit={method:'PATCH',headers:{'Content-Type':'text/plain; charset=utf-8'},body:input.text ?? ''};const upload=row.credential_kind==='google_oauth'?await callWithGoogleToken('google_drive',decryptConnectionKey(row.connection_key_ciphertext),`/upload/drive/v3/files/${enc(b.id)}?uploadType=media`,uploadInit):await callAsAppUser({gatewayBaseUrl:BASE,connectionAPIKey:decryptConnectionKey(row.connection_key_ciphertext),connectorId:id,path:`/upload/drive/v3/files/${enc(b.id)}?uploadType=media`,requiredScopes:PROVIDERS[id].scopes,init:uploadInit});if(!upload.ok)throw new Error(`Drive 文件内容上传失败 (${upload.status}): ${(await upload.text()).slice(0,1200)}`);items=[{title:input.title ?? '',id:b.id}];}
 } else {
 if(o==='channels'){const b=await request('/api/conversations.list?limit=50&exclude_archived=true');items=(b.channels ?? []).map((v:any)=>({title:v.name,id:v.id}));if(b.response_metadata?.next_cursor)text='仅显示前 50 个频道';}
 if(o==='history'){const b=await request(`/api/conversations.history?limit=20&channel=${enc(input.id ?? '')}`);const users=new Map<string,string>();for(const v of b.messages ?? []){if(v.user && !users.has(v.user)){try{const u=await request(`/api/users.info?user=${enc(v.user)}`);users.set(v.user,u.user?.profile?.display_name || u.user?.real_name || u.user?.name || '未知成员');}catch{users.set(v.user,'未知成员');}}}items=(b.messages ?? []).map((v:any)=>({title:users.get(v.user) ?? '系统消息',detail:(v.text ?? '').slice(0,3000)}));}
 if(o==='send'){const b=await request('/api/chat.postMessage','POST',{channel:input.id,text:input.text});items=[{title:input.text?.slice(0,100) ?? '消息',id:b.ts}];}
 }
 return {provider,status:'completed',summary:isWrite(o)?'操作已完成':'读取完成',items,...(text?{text}:{})};
}
