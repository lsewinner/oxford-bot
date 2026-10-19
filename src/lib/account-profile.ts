import { z } from 'zod';
export const profileSchema=z.object({nickname:z.string().trim().min(1,'请输入昵称').max(40,'昵称不能超过 40 个字符'),avatar:z.string().max(30000).refine(v=>v===''||/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(v)||/^https:\/\//.test(v),'头像格式无效')});
export type Profile=z.infer<typeof profileSchema>;
export function accountProfile(metadata:Record<string,unknown>={}):Profile {
 const name=[metadata.oxford_nickname,metadata.full_name,metadata.name].find(v=>typeof v==='string'&&v.trim()&&!v.includes('@'));
 const avatar=typeof metadata.oxford_avatar==='string'?metadata.oxford_avatar:typeof metadata.avatar_url==='string'?metadata.avatar_url:'';
 return {nickname:typeof name==='string'?name.trim().slice(0,40):'我的账户',avatar:profileSchema.shape.avatar.safeParse(avatar).success?avatar:''};
}
export function profileMetadata(profile:Profile){const v=profileSchema.parse(profile);return {oxford_nickname:v.nickname,oxford_avatar:v.avatar};}
export async function prepareProfileAvatar(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('请选择 JPG、PNG 或 WebP 图片');
 if(file.size>5*1024*1024)throw new Error('头像图片不能超过 5 MB');
 const url=URL.createObjectURL(file);
 try {const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('当前浏览器无法处理图片');const size=Math.min(image.naturalWidth,image.naturalHeight);ctx.drawImage(image,(image.naturalWidth-size)/2,(image.naturalHeight-size)/2,size,size,0,0,128,128);return canvas.toDataURL('image/jpeg',0.75);}finally{URL.revokeObjectURL(url);}
}