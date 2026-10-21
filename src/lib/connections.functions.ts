import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import { providerId,PROVIDERS,operationInput,type ToolResult } from './connections/catalog';
const BASE='https://connector-gateway.lovable.dev';
const selection=z.object({id:providerId});
export const connectPersonalToken=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>z.object({id:z.enum(['github','slack','cloudflare','supabase','notion','yuque']),token:z.string().trim().min(1).max(4096).regex(/^[\x21-\x7E]+$/),label:z.string().trim().max(60).optional()}).strict().parse(v)).handler(async({data,context})=>{await (await import('./pro.server')).requirePro(context.supabase as never,context.userId);
 const {validatePersonalToken,personalTokenIdentity}=await import('./connections/personal-token.server');
 const {saveConnection}=await import('./connections/storage.server');
 const body=await validatePersonalToken(data.id,data.token);
 const who=await personalTokenIdentity(data.id,data.token,body??null);
 await saveConnection(context.userId,data.id,data.token,'personal_token',who.account,data.label||who.label);
 return {ok:true};
});
export const connectionStatus=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {getConnections,decryptConnectionKey}=await import('./connections/storage.server');
 const {callAsAppUser,appUserReconnectRequired}=await import('@/integrations/lovable/appUserConnector');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const paths={github:'/user',google_mail:'/gmail/v1/users/me/profile',microsoft_outlook:'/me?$select=displayName',microsoft_teams:'/me/joinedTeams',microsoft_calendar:'/me/calendars?$top=1',google_drive:'/drive/v3/about?fields=user(displayName,emailAddress)',google_calendar:'/calendar/v3/users/me/calendarList/primary',slack:'/api/auth.test',cloudflare:'/zones?per_page=1',supabase:'/projects',notion:'/users/me',yuque:'/user',feishu:'/bot/v3/info',linear:''};
 const withRetry=async<T>(fn:()=>Promise<T>)=>{try{return await fn();}catch(first){await new Promise(r=>setTimeout(r,800));try{return await fn();}catch{throw first;}}};

 const perProvider=await Promise.all(providerId.options.map(async(id)=>{
  const configured=id==='google_mail'||id==='google_drive'||id==='google_calendar'?Boolean(process.env['GOOGLE_OAUTH_CLIENT_ID'] && process.env['GOOGLE_OAUTH_CLIENT_SECRET']):id==='microsoft_outlook'||id==='microsoft_teams'||id==='microsoft_calendar'?Boolean(process.env['MICROSOFT_OAUTH_CLIENT_SECRET']):id==='notion'?Boolean(process.env['NOTION_OAUTH_CLIENT_ID'] && process.env['NOTION_OAUTH_CLIENT_SECRET']):id==='github'?(Boolean(process.env['GITHUB_OAUTH_CLIENT_ID'] && process.env['GITHUB_OAUTH_CLIENT_SECRET'])||Boolean(process.env['GITHUB_APP_USER_CONNECTOR_CLIENT_API_KEY'])):id==='slack'?(Boolean(process.env['SLACK_OAUTH_CLIENT_ID'] && process.env['SLACK_OAUTH_CLIENT_SECRET'])||Boolean(process.env['SLACK_APP_USER_CONNECTOR_CLIENT_API_KEY'])):id==='linear'?Boolean(process.env['LINEAR_OAUTH_CLIENT_ID'] && process.env['LINEAR_OAUTH_CLIENT_SECRET']):Boolean(process.env[`${id.toUpperCase()}_APP_USER_CONNECTOR_CLIENT_API_KEY`]);const rows=await getConnections(context.userId,id);
  if(!rows.length)return [{id,rowId:null as string|null,account:'',label:'',configured,credentialKind:'oauth',connected:false,enabled:false,reconnectRequired:false,connectionError:''}];
  return Promise.all(rows.map(async(row)=>{let account=row.account_key;
  let reconnectRequired=row?.reconnect_required ?? false;let connectionError='';
  if(row && !reconnectRequired){
   try{
     if(row.credential_kind==='personal_token'){
       const {supportsPersonalToken,validatePersonalToken}=await import('./connections/personal-token.server');
       if(!supportsPersonalToken(id))throw new Error('不支持此服务的个人 Token');
       await withRetry(()=>validatePersonalToken(id,decryptConnectionKey(row.connection_key_ciphertext,'personal_token')));
     } else if(row.credential_kind==='google_oauth'){
       const {callWithGoogleToken,GoogleReconnectError,isGoogleProvider}=await import('./connections/google-oauth.server');
       if(!isGoogleProvider(id))throw new Error('此服务不支持 Google 授权');
       try{
         const response=await withRetry(()=>callWithGoogleToken(id,decryptConnectionKey(row.connection_key_ciphertext),paths[id]));
         if(!response.ok)connectionError=`${PROVIDERS[id].name} (${response.status})`;
         else{const b=await response.json().catch(()=>null) as {emailAddress?:string;user?:{emailAddress?:string}}|null;const email=(b?.emailAddress ?? b?.user?.emailAddress ?? '').toLowerCase();if(!account && email){const {error}=await supabaseAdmin.from('app_user_connections').update({account_key:email}).eq('id',row.id).eq('user_id',context.userId);if(!error)account=email;}}
       }catch(e){if(e instanceof GoogleReconnectError){reconnectRequired=true;await supabaseAdmin.from('app_user_connections').update({reconnect_required:true}).eq('id',row.id).eq('user_id',context.userId);}else throw e;}
     } else if(row.credential_kind==='microsoft_oauth'){
        if(id!=='microsoft_outlook' && id!=='microsoft_teams' && id!=='microsoft_calendar')throw new Error('此服务不支持微软授权');
        const {callWithMicrosoftToken,MicrosoftReconnectError}=await import('./connections/microsoft-oauth.server');
        const {rotateMicrosoftCredential}=await import('./connections/storage.server');
        try{
          const response=await callWithMicrosoftToken(decryptConnectionKey(row.connection_key_ciphertext,'microsoft_oauth'),id==='microsoft_outlook'?'/me?$select=id':paths[id],undefined,token=>rotateMicrosoftCredential(context.userId,row.id,row.connection_key_ciphertext,token),id);
          if(response.status===401)throw new MicrosoftReconnectError();
          if(!response.ok)connectionError=`${PROVIDERS[id].name} (${response.status}): ${(await response.text()).slice(0,800)}`;
          else await response.arrayBuffer();
        }catch(e){if(e instanceof MicrosoftReconnectError){reconnectRequired=true;await supabaseAdmin.from('app_user_connections').update({reconnect_required:true}).eq('id',row.id).eq('user_id',context.userId);}else throw e;}
      } else if(row.credential_kind==='linear_oauth'){
        // Linear's access token lasts 24 hours and its refresh token rotates, so the probe runs one real refresh.
        const {callLinearGraphQL,LinearReconnectError,LINEAR_VIEWER_QUERY}=await import('./connections/linear-oauth.server');
        const {rotateLinearCredential}=await import('./connections/storage.server');
        try{
          const response=await callLinearGraphQL(decryptConnectionKey(row.connection_key_ciphertext,'linear_oauth'),LINEAR_VIEWER_QUERY,undefined,token=>rotateLinearCredential(context.userId,row.id,row.connection_key_ciphertext,token));
          if(!response.ok)connectionError=`${PROVIDERS[id].name} (${response.status})`;
          else{const b=await response.json().catch(()=>null) as {data?:{organization?:{id?:string}};errors?:{message?:string}[]}|null;if(b?.errors?.length)connectionError=`Linear：${b.errors[0]?.message ?? '请求失败'}`;else if(!account && b?.data?.organization?.id){const key=`ln-${b.data.organization.id}`.toLowerCase();const {error}=await supabaseAdmin.from('app_user_connections').update({account_key:key}).eq('id',row.id).eq('user_id',context.userId);if(!error)account=key;}}
        }catch(e){if(e instanceof LinearReconnectError){reconnectRequired=true;await supabaseAdmin.from('app_user_connections').update({reconnect_required:true}).eq('id',row.id).eq('user_id',context.userId);}else throw e;}
      } else {const response=await callAsAppUser({gatewayBaseUrl:BASE,connectorId:id,connectionAPIKey:decryptConnectionKey(row.connection_key_ciphertext),path:paths[id],requiredScopes:PROVIDERS[id].scopes});
       if(await appUserReconnectRequired(response)){reconnectRequired=true;await supabaseAdmin.from('app_user_connections').update({reconnect_required:true}).eq('id',row.id).eq('user_id',context.userId);}
       else if(!response.ok){connectionError=`${PROVIDERS[id].name} (${response.status}): ${(await response.text()).slice(0,800)}`;}
       else if(id==='slack'){const b=await response.json();if(b.ok===false)connectionError=`Slack: ${b.error}`;}
       else await response.arrayBuffer();}
     }catch(error){const msg=error instanceof Error?error.message:'';connectionError=/fetch|network|ECONN|ETIMEDOUT|timed out|无法访问/i.test(msg)?'暂时无法访问服务，请稍后重试':msg||'连接检查失败';}
   }
   return {id,rowId:row.id as string|null,account,label:row.account_label || account,configured,credentialKind:row.credential_kind,connected:true,enabled:row.enabled,reconnectRequired,connectionError};
  }));
 }));
 return perProvider.flat();
});
export const startConnection=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>selection.parse(v)).handler(async({data,context})=>{await (await import('./pro.server')).requirePro(context.supabase as never,context.userId);
 const client=process.env[`${data.id.toUpperCase()}_APP_USER_CONNECTOR_CLIENT_API_KEY`];if(!client)throw new Error('管理员尚未配置此服务的授权应用');
 const {getConnection,decryptConnectionKey}=await import('./connections/storage.server');const {authorizeAppUserOAuth}=await import('@/integrations/lovable/appUserConnector');const row=await getConnection(context.userId,data.id);
 const request=getRequest();const url=new URL(request.url);const sandboxHost=url.hostname==='localhost'?request.headers.get('x-forwarded-host'):null;const origin=sandboxHost?`https://${sandboxHost}`:url.origin;
 return authorizeAppUserOAuth({gatewayBaseUrl:BASE,connectorId:data.id,appUserId:context.userId,clientAPIKey:client,returnUrl:new URL('/api/public/oauth/return',origin).toString(),...(row && row.credential_kind!=='personal_token'?{connectionAPIKey:decryptConnectionKey(row.connection_key_ciphertext)}:{}),credentialsConfiguration:{scopes:PROVIDERS[data.id].scopes,...(data.id==='microsoft_outlook'?{domain_hint:'none',prompt:'select_account'}:{})}});
});
export const startGoogleOAuth=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>z.object({id:z.enum(['google_mail','google_drive','google_calendar'])}).strict().parse(v)).handler(async({data,context})=>{await (await import('./pro.server')).requirePro(context.supabase as never,context.userId);
 const {buildGoogleAuthUrl,signState}=await import('./connections/google-oauth.server');
 const request=getRequest();const url=new URL(request.url);const sandboxHost=url.hostname==='localhost'?request.headers.get('x-forwarded-host'):null;const origin=sandboxHost?`https://${sandboxHost}`:url.origin;
 const redirectUri=new URL('/api/oauth/google/callback',origin).toString();
 return {authorizationUrl:buildGoogleAuthUrl(data.id,redirectUri,signState(context.userId,data.id))};
});
export const startNotionOAuth=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{await (await import('./pro.server')).requirePro(context.supabase as never,context.userId);
 const {buildNotionAuthUrl,signNotionState}=await import('./connections/notion-oauth.server');
 const request=getRequest();const url=new URL(request.url);const sandboxHost=url.hostname==='localhost'?request.headers.get('x-forwarded-host'):null;const origin=sandboxHost?`https://${sandboxHost}`:url.origin;
 return {authorizationUrl:buildNotionAuthUrl(new URL('/api/oauth/notion/callback',origin).toString(),signNotionState(context.userId))};
});
export const startGithubOAuth=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{await (await import('./pro.server')).requirePro(context.supabase as never,context.userId);
 const {buildGithubAuthUrl,signGithubState}=await import('./connections/github-oauth.server');
 const request=getRequest();const url=new URL(request.url);const sandboxHost=url.hostname==='localhost'?request.headers.get('x-forwarded-host'):null;const origin=sandboxHost?`https://${sandboxHost}`:url.origin;
 return {authorizationUrl:buildGithubAuthUrl(new URL('/api/oauth/github/callback',origin).toString(),signGithubState(context.userId))};
});
export const startSlackOAuth=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{await (await import('./pro.server')).requirePro(context.supabase as never,context.userId);
 const {buildSlackAuthUrl,signSlackState}=await import('./connections/slack-oauth.server');
 const request=getRequest();const url=new URL(request.url);const sandboxHost=url.hostname==='localhost'?request.headers.get('x-forwarded-host'):null;const origin=sandboxHost?`https://${sandboxHost}`:url.origin;
 return {authorizationUrl:buildSlackAuthUrl(new URL('/api/oauth/slack/callback',origin).toString(),signSlackState(context.userId))};
});
export const startMicrosoftOAuth=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>z.object({id:z.enum(['microsoft_outlook','microsoft_teams','microsoft_calendar']).default('microsoft_outlook')}).strict().parse(v ?? {})).handler(async({data,context})=>{await (await import('./pro.server')).requirePro(context.supabase as never,context.userId);
 const {startMicrosoftAuthorization}=await import('./connections/microsoft-oauth.server');
 const request=getRequest();const url=new URL(request.url);const sandboxHost=url.hostname==='localhost'?request.headers.get('x-forwarded-host'):null;const origin=sandboxHost?`https://${sandboxHost}`:url.origin;
 return startMicrosoftAuthorization(context.userId,new URL('/api/oauth/microsoft/callback',origin).toString(),data.id);
});
export const completeMicrosoftOAuth=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>z.object({code:z.string().min(1).max(8192),state:z.string().min(1).max(4096)}).strict().parse(v)).handler(async({data,context})=>{
 const {verifyMicrosoftState,exchangeMicrosoftCode,getMicrosoftAccount}=await import('./connections/microsoft-oauth.server');
 const payload=verifyMicrosoftState(data.state);
 if(payload.userId!==context.userId)throw new Error('授权不属于当前账户');
 const request=getRequest();const url=new URL(request.url);const sandboxHost=url.hostname==='localhost'?request.headers.get('x-forwarded-host'):null;const origin=sandboxHost?`https://${sandboxHost}`:url.origin;
 if(payload.redirectUri!==new URL('/api/oauth/microsoft/callback',origin).toString())throw new Error('授权地址不匹配');
 const tokens=await exchangeMicrosoftCode(data.code,payload);const identity=await getMicrosoftAccount(tokens.accessToken);
 const {saveConnection}=await import('./connections/storage.server');
 await saveConnection(context.userId,payload.provider,tokens.refreshToken,'microsoft_oauth',identity.account,identity.label);
 return {ok:true};
});
export const startLinearOAuth=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).handler(async({context})=>{await (await import('./pro.server')).requirePro(context.supabase as never,context.userId);
 const {buildLinearAuthUrl,signLinearState}=await import('./connections/linear-oauth.server');
 const request=getRequest();const url=new URL(request.url);const sandboxHost=url.hostname==='localhost'?request.headers.get('x-forwarded-host'):null;const origin=sandboxHost?`https://${sandboxHost}`:url.origin;
 return {authorizationUrl:buildLinearAuthUrl(new URL('/api/oauth/linear/callback',origin).toString(),signLinearState(context.userId))};
});
export const completeConnection=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>selection.extend({code:z.string().min(1).max(4096)}).parse(v)).handler(async({data,context})=>{
 const {exchangeAppUserOAuthCode}=await import('@/integrations/lovable/appUserConnector');const {saveConnection}=await import('./connections/storage.server');const result=await exchangeAppUserOAuthCode(BASE,data.code);if(result.connectorId!==data.id)throw new Error('授权服务不匹配');await saveConnection(context.userId,data.id,result.connectionAPIKey);return {ok:true};
});
export const updateConnection=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(v=>selection.extend({rowId:z.string().uuid(),enabled:z.boolean().optional(),disconnect:z.boolean().optional()}).parse(v)).handler(async({data,context})=>{
 const {decryptConnectionKey}=await import('./connections/storage.server');const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {data:row}=await supabaseAdmin.from('app_user_connections').select('*').eq('id',data.rowId).eq('user_id',context.userId).eq('connector_id',data.id).maybeSingle();if(!row)throw new Error('此账户尚未连接');
 if(data.disconnect){if(row.credential_kind==='oauth'){const {disconnectAppUser}=await import('@/integrations/lovable/appUserConnector');await disconnectAppUser({gatewayBaseUrl:BASE,connectorId:data.id,connectionAPIKey:decryptConnectionKey(row.connection_key_ciphertext)});}if(row.credential_kind==='linear_oauth'){const {revokeLinearToken}=await import('./connections/linear-oauth.server');await revokeLinearToken(decryptConnectionKey(row.connection_key_ciphertext,'linear_oauth'));}const {error}=await supabaseAdmin.from('app_user_connections').delete().eq('id',row.id).eq('user_id',context.userId);if(error)throw new Error('删除连接失败');}else{const {error}=await supabaseAdmin.from('app_user_connections').update({...(data.enabled===undefined?{}:{enabled:data.enabled}),updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',context.userId);if(error)throw new Error('更新连接失败');}return {ok:true};
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
