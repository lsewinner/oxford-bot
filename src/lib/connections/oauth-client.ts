import type { ProviderId } from './catalog';
export function waitForOAuth(popup:Window,id:ProviderId){return new Promise<string|null>((resolve,reject)=>{
 let poll:number|undefined;const timeout=window.setTimeout(()=>finish(new Error('授权超时，请重试')),300000);
 function cleanup(){window.removeEventListener('message',onMessage);if(poll!==undefined)window.clearInterval(poll);window.clearTimeout(timeout);}
 function finish(error:Error){cleanup();popup.close();reject(error);}
 function onMessage(e:MessageEvent){if(e.origin!==window.location.origin || e.source!==popup || e.data?.connectorId!==id)return;
 if(e.data.type==='appUserConnectorOAuthFailed'){finish(new Error('授权未完成'));return;}if(e.data.type!=='appUserConnectorOAuthComplete')return;cleanup();resolve(typeof e.data.code==='string'?e.data.code:null);}
 window.addEventListener('message',onMessage);poll=window.setInterval(()=>{if(popup.closed)finish(new Error('已取消授权'));},600);
 });}
