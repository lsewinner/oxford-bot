/** Server-only connector gateway helpers. Import only inside handlers. */
function requireApiKey() { const key=process.env['LOVABLE_API_KEY']; if(!key) throw new Error('连接服务未配置'); return key; }
export interface AppUserOAuthAuthorizeParams { gatewayBaseUrl:string; connectorId:string; appUserId:string; clientAPIKey:string; returnUrl:string; connectionAPIKey?:string; credentialsConfiguration?:Record<string,unknown> }
export async function authorizeAppUserOAuth(p:AppUserOAuthAuthorizeParams) {
 const headers:Record<string,string>={Authorization:`Bearer ${requireApiKey()}`,'Content-Type':'application/json','X-Client-Api-Key':p.clientAPIKey};
 if(p.connectionAPIKey) headers['X-Connection-Api-Key']=p.connectionAPIKey;
 const r=await fetch(`${p.gatewayBaseUrl}/api/v1/app-users/oauth2/authorize`,{method:'POST',headers,body:JSON.stringify({connector_id:p.connectorId,app_user_id:p.appUserId,return_url:p.returnUrl,credentials_configuration:p.credentialsConfiguration})});
 if(!r.ok) throw new Error(`授权启动失败 (${r.status})`);
 const b=await r.json() as {authorization_url?:string;session_id?:string}; if(!b.authorization_url) throw new Error('授权地址缺失'); return {authorizationUrl:b.authorization_url,sessionId:b.session_id ?? ''};
}
export async function callAsAppUser(p:{gatewayBaseUrl:string;connectionAPIKey:string;connectorId:string;path:string;init?:RequestInit;requiredScopes?:readonly string[]}) {
 const headers=new Headers(p.init?.headers); headers.set('Authorization',`Bearer ${requireApiKey()}`); headers.set('X-Connection-Api-Key',p.connectionAPIKey); if(p.requiredScopes?.length) headers.set('X-Lovable-Required-Scopes',p.requiredScopes.join(' '));
 return fetch(`${p.gatewayBaseUrl}/${p.connectorId}${p.path.startsWith('/')?p.path:'/'+p.path}`,{...p.init,headers});
}
export async function appUserReconnectRequired(r:Response) { if(r.status!==401)return false; const b=await r.clone().json().catch(()=>null);return typeof b?.type==='string' && b.type.startsWith('credential_'); }
export async function exchangeAppUserOAuthCode(base:string,code:string) {
 const r=await fetch(`${base}/api/v1/app-users/oauth2/exchange`,{method:'POST',headers:{Authorization:`Bearer ${requireApiKey()}`,'Content-Type':'application/json'},body:JSON.stringify({code})});
 if(!r.ok)throw new Error(`授权保存失败 (${r.status})`); const b=await r.json() as {api_key?:string;connector_id?:string};if(!b.api_key || !b.connector_id)throw new Error('授权未返回持续访问凭据');return {connectionAPIKey:b.api_key,connectorId:b.connector_id};
}
export async function disconnectAppUser(p:{gatewayBaseUrl:string;connectionAPIKey:string;connectorId:string}) {
 const r=await fetch(`${p.gatewayBaseUrl}/api/v1/app-users/connection`,{method:'DELETE',headers:{Authorization:`Bearer ${requireApiKey()}`,'X-Connection-Api-Key':p.connectionAPIKey,'Content-Type':'application/json'},body:JSON.stringify({connector_id:p.connectorId})});if(!r.ok)throw new Error(`断开失败 (${r.status})`);
}
