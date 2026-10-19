import { createCipheriv,createDecipheriv,randomBytes,createHash } from 'node:crypto';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import type { ProviderId } from './catalog';
import { resolveConnectionSecret } from './connection-secret.server';
function key(kind='oauth'){const raw=resolveConnectionSecret(kind==='personal_token'?'personal_token':'connection');return createHash('sha256').update(raw).digest();}
export function encryptConnectionKey(text:string,kind='oauth'){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(kind),iv);const ct=Buffer.concat([c.update(text,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),ct]).toString('base64');}
export function decryptConnectionKey(text:string,kind='oauth'){const b=Buffer.from(text,'base64'),d=createDecipheriv('aes-256-gcm',key(kind),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8');}
export async function getConnections(userId:string,id:ProviderId){const {data,error}=await supabaseAdmin.from('app_user_connections').select('*').eq('user_id',userId).eq('connector_id',id).order('created_at');if(error)throw new Error('读取连接失败');return data ?? [];}
/** Picks the named account (case-insensitive), else the first enabled account, else the first one. */
export async function getConnection(userId:string,id:ProviderId,account?:string){const rows=await getConnections(userId,id);if(account){const a=account.trim().toLowerCase();return rows.find(r=>r.account_key.toLowerCase()===a) ?? null;}return rows.find(r=>r.enabled && !r.reconnect_required) ?? rows[0] ?? null;}
export async function saveConnection(userId:string,id:ProviderId,credential:string,kind:'oauth'|'personal_token'|'google_oauth'='oauth',account=''){const {error}=await supabaseAdmin.from('app_user_connections').upsert({user_id:userId,connector_id:id,account_key:account.trim().toLowerCase(),credential_kind:kind,connection_key_ciphertext:encryptConnectionKey(credential,kind),enabled:true,reconnect_required:false,updated_at:new Date().toISOString()},{onConflict:'user_id,connector_id,account_key'});if(error)throw new Error('保存连接失败');}
