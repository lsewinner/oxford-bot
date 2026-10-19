import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import type { ProviderId } from './catalog';
function key(){const raw=process.env['APP_USER_CONNECTION_KEY_SECRET'];if(!raw)throw new Error('连接加密尚未配置');const k=Buffer.from(raw,'base64');if(k.length!==32)throw new Error('连接加密配置无效');return k;}
export function encryptConnectionKey(text:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(),iv);const ct=Buffer.concat([c.update(text,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),ct]).toString('base64');}
export function decryptConnectionKey(text:string){const b=Buffer.from(text,'base64'),d=createDecipheriv('aes-256-gcm',key(),b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8');}
export async function getConnection(userId:string,id:ProviderId){const {data,error}=await supabaseAdmin.from('app_user_connections').select('*').eq('user_id',userId).eq('connector_id',id).maybeSingle();if(error)throw new Error('读取连接失败');return data;}
export async function saveConnection(userId:string,id:ProviderId,credential:string){const {error}=await supabaseAdmin.from('app_user_connections').upsert({user_id:userId,connector_id:id,connection_key_ciphertext:encryptConnectionKey(credential),enabled:true,reconnect_required:false,updated_at:new Date().toISOString()},{onConflict:'user_id,connector_id'});if(error)throw new Error('保存连接失败');}
