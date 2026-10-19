import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { providerId,PROVIDERS,operationInput,type ToolResult } from './connections/catalog';
const BASE='https://connector-gateway.lovable.dev';
const selection=z.object({id:providerId});
export const connectPersonalToken=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>z.object({id:z.enum(['github','slack']),token:z.string().trim().min(1).max(4096).regex(/^[\x21-\x7E]+$/)}).strict().parse(v)).handler(async({data,context})=>{
 const {validatePersonalToken}=await import('./connections/personal-token.server');
 const {saveConnection}=await import('./connections/storage.server');
 await validatePersonalToken(data.id,data.token);
 await saveConnection(context.userId,data.id,data.token,'personal_token');
 return {ok:true};
});
export const connectionStatus=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {getConnection,decryptConnectionKey}=await import('./connections/storage.server');
 const {callAsAppUser,appUserReconnectRequired}=await import('@/integrations/lovable/appUserConnector');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const paths={github:'/user',google_mail:'/gmail/v1/users/me/profile',microsoft_outlook:'/me?$select=displayName',google_drive:'/drive/v3/about?fields=user(displayName)',slack:'/api/auth.test'};
 return Promise.all(providerId.options.map(async(id)=>{
   const configured=Boolean(process.env[`${id.toUpperCase()}_APP_USER_CONNECTOR_CLIENT_API_KEY`]);const row=await getConnection(context.userId,id);
   let reconnectRequired=row?.reconnect_required ?? false;let connectionError='';
   if(row && !reconnectRequired){
     try{
       if(row.credential_kind==='personal_token'){
         const {supportsPersonalToken,validatePersonalToken}=await import('./connections/personal-token.server');
         if(!supportsPersonalToken(id))throw new Error('不支持此服务的个人 Token');
         await validatePersonalToken(id,decryptConnectionKey(row.connection_key_ciphertext,'personal_token'));
       } else {const response=await callAsAppUser({gatewayBaseUrl:BASE,connectorId:id,connectionAPIKey:decryptConnectionKey(row.connection_key_ciphertext),path:paths[id],requiredScopes:PROVIDERS[id].scopes});
       if(await appUserReconnectRequired(response)){reconnectRequired=true;await supabaseAdmin.from('app_user_connections').update({reconnect_required:true}).eq('id',row.id).eq('user_id',context.userId);}
       else if(!response.ok){connectionError=`${PROVIDERS[id].name} (${response.status}): ${(await response.text()).slice(0,800)}`;}
       else if(id==='slack'){const b=await response.json();if(b.ok===false)connectionError=`Slack: ${b.error}`;}
       else await response.arrayBuffer();}
     }catch(error){connectionError=error instanceof Error?error.message:'连接检查失败';}
   }
   return {id,configured,credentialKind:row?.credential_kind ?? 'oauth',connected:Boolean(row),enabled:row?.enabled ?? false,reconnectRequired,connectionError};
 }));
});
export const startConnection=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>selection.parse(v)).handler(async({data,context})=>{
 const client=process.env[`${data.id.toUpperCase()}_APP_USER_CONNECTOR_CLIENT_API_KEY`];if(!client)throw new Error('管理员尚未配置此服务的授权应用');
 const {getConnection,decryptConnectionKey}=await import('./connections/storage.server');const {authorizeAppUserOAuth}=await import('@/integrations/lovable/appUserConnector');const row=await getConnection(context.userId,data.id);
 const request=getRequest();const url=new URL(request.url);const sandboxHost=url.hostname==='localhost'?request.headers.get('x-forwarded-host'):null;const origin=sandboxHost?`https://${sandboxHost}`:url.origin;
 return authorizeAppUserOAuth({gatewayBaseUrl:BASE,connectorId:data.id,appUserId:context.userId,clientAPIKey:client,returnUrl:new URL('/api/public/oauth/return',origin).toString(),...(row && row.credential_kind!=='personal_token'?{connectionAPIKey:decryptConnectionKey(row.connection_key_ciphertext)}:{}),credentialsConfiguration:{scopes:PROVIDERS[data.id].scopes,...(data.id==='microsoft_outlook'?{domain_hint:'none',prompt:'select_account'}:{})}});
});
export const completeConnection=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>selection.extend({code:z.string().min(1).max(4096)}).parse(v)).handler(async({data,context})=>{
 const {exchangeAppUserOAuthCode}=await import('@/integrations/lovable/appUserConnector');const {saveConnection}=await import('./connections/storage.server');const result=await exchangeAppUserOAuthCode(BASE,data.code);if(result.connectorId!==data.id)throw new Error('授权服务不匹配');await saveConnection(context.userId,data.id,result.connectionAPIKey);return {ok:true};
});
export const updateConnection=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>selection.extend({enabled:z.boolean().optional(),disconnect:z.boolean().optional()}).parse(v)).handler(async({data,context})=>{
 const {getConnection,decryptConnectionKey}=await import('./connections/storage.server');const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const row=await getConnection(context.userId,data.id);if(!row)throw new Error('此账户尚未连接');
 if(data.disconnect){if(row.credential_kind!=='personal_token'){const {disconnectAppUser}=await import('@/integrations/lovable/appUserConnector');await disconnectAppUser({gatewayBaseUrl:BASE,connectorId:data.id,connectionAPIKey:decryptConnectionKey(row.connection_key_ciphertext)});}const {error}=await supabaseAdmin.from('app_user_connections').delete().eq('id',row.id).eq('user_id',context.userId);if(error)throw new Error('删除连接失败');}else{const {error}=await supabaseAdmin.from('app_user_connections').update({...(data.enabled===undefined?{}:{enabled:data.enabled}),updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',context.userId);if(error)throw new Error('更新连接失败');}return {ok:true};
});
export const runOperation=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>selection.extend({input:operationInput}).parse(v)).handler(async({data,context})=>{const {executeOperation}=await import('./connections/execute.server');return executeOperation(context.userId,data.id,data.input);});
export const confirmOperation=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>z.object({actionId:z.string().uuid(),approve:z.boolean()}).parse(v)).handler(async({data,context}):Promise<ToolResult>=>{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:row,error}=await supabaseAdmin.from('tool_actions').update({status:data.approve?'executing':'cancelled',updated_at:new Date().toISOString()}).eq('id',data.actionId).eq('user_id',context.userId).eq('status','pending').select('*').maybeSingle();
 if(error || !row)throw new Error('操作已处理或不属于此账户');
 const id=providerId.parse(row.connector_id);let result:ToolResult;
 try{const {executeOperation}=await import('./connections/execute.server');result=data.approve?await executeOperation(context.userId,id,operationInput.parse(row.payload),true):{provider:PROVIDERS[id].name,status:'cancelled',summary:'已取消，未执行'};}catch(e){result={provider:PROVIDERS[id].name,status:'error',summary:e instanceof Error?e.message:'操作失败'};}
 await supabaseAdmin.from('tool_actions').update({status:result.status,result:result as never,updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',context.userId);return result;
});
export const actionStatus=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>z.object({actionId:z.string().uuid()}).parse(v)).handler(async({data,context})=>{const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {data:row,error}=await supabaseAdmin.from('tool_actions').select('status,result').eq('id',data.actionId).eq('user_id',context.userId).maybeSingle();if(error || !row)throw new Error('操作不存在');return {status:row.status,result:row.result as ToolResult|null};});
