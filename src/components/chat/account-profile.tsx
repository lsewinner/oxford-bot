import { useEffect,useId,useRef,useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { CameraIcon,LoaderCircleIcon,LogOutIcon,Trash2Icon,FlameIcon,SparklesIcon,ShieldCheckIcon,DownloadIcon,PencilIcon,ChevronsUpDownIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { usePro } from '@/components/pro/pro-context';
import { useDesktopInstall } from '@/components/desktop-install';
import { TrendsDrawer } from './trends-drawer';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { accountProfile,prepareProfileAvatar,profileMetadata,type Profile } from '@/lib/account-profile';
import { Avatar,AvatarImage,AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogTitle,DialogDescription,DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
function ProfileAvatar({profile,large=false}:{profile:Profile;large?:boolean}){return <Avatar className={large?'size-20':'size-9'}><AvatarImage src={profile.avatar} alt={profile.nickname} className="object-cover"/><AvatarFallback className={large?'text-2xl':'text-sm'}>{Array.from(profile.nickname).slice(0,2).join('')}</AvatarFallback></Avatar>;}
export function AccountProfile({user,onSignOut,isAdmin=false}:{user:User;onSignOut:()=>void|Promise<void>;isAdmin?:boolean}){
 const {isPro,openUpgrade}=usePro();const desk=useDesktopInstall();const [trends,setTrends]=useState(false);
 const [profile,setProfile]=useState(()=>accountProfile(user.user_metadata));const [draft,setDraft]=useState(profile),[open,setOpen]=useState(false),[saving,setSaving]=useState(false),[processing,setProcessing]=useState(false);const upload=useRef<HTMLInputElement>(null);const id=useId();
 useEffect(()=>{setProfile(accountProfile(user.user_metadata));},[user.id,user.user_metadata]);
 useEffect(()=>{const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='USER_UPDATED'&&session?.user.id===user.id)setProfile(accountProfile(session.user.user_metadata));});return ()=>data.subscription.unsubscribe();},[user.id]);
 const save=async()=>{setSaving(true);try{const {data,error}=await supabase.auth.updateUser({data:profileMetadata(draft)});if(error)throw error;if(!data.user)throw new Error('登录已失效，请重新登录');setProfile(accountProfile(data.user.user_metadata));setOpen(false);toast.success('个人资料已保存');}catch(error){toast.error(error instanceof Error?error.message:'保存失败，请重试');}finally{setSaving(false);}};
 return <><div className="shrink-0 border-t border-sidebar-border px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" aria-label="账户菜单" className="h-14 w-full justify-start gap-3 px-2"><ProfileAvatar profile={profile}/><span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{profile.nickname}</span>{isPro&&<span className="rounded border border-border px-1.5 text-[10px] font-semibold">PRO</span>}<ChevronsUpDownIcon className="size-4 text-muted-foreground"/></Button></DropdownMenuTrigger>
 <DropdownMenuContent side="top" align="start" className="w-64">
  <DropdownMenuLabel className="flex items-center gap-3 py-2"><ProfileAvatar profile={profile}/><span className="min-w-0"><span className="block truncate text-sm">{profile.nickname}</span><span className="block text-xs font-normal text-muted-foreground">{isPro?'Oxford Pro':'Free'}</span></span></DropdownMenuLabel><DropdownMenuSeparator/>
  <DropdownMenuItem onSelect={()=>setTrends(true)}><FlameIcon/>实时热点</DropdownMenuItem>
  <DropdownMenuItem onSelect={()=>openUpgrade('general')}><SparklesIcon/>{isPro?'Oxford Pro · 管理订阅':'升级到 Pro'}</DropdownMenuItem>
  {isAdmin&&<DropdownMenuItem asChild><Link to="/admin"><ShieldCheckIcon/>管理后台</Link></DropdownMenuItem>}
  <DropdownMenuItem disabled={desk.installed||desk.busy} onSelect={()=>desk.install()}><DownloadIcon/>{desk.installed?'已安装桌面端':'安装桌面端'}</DropdownMenuItem>
  <DropdownMenuItem onSelect={()=>{setDraft(profile);setOpen(true);}}><PencilIcon/>修改资料</DropdownMenuItem><DropdownMenuSeparator/>
  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={()=>void onSignOut()}><LogOutIcon/>退出登录</DropdownMenuItem>
 </DropdownMenuContent></DropdownMenu></div>
 <TrendsDrawer open={trends} onOpenChange={setTrends}/>
 <Dialog open={open} onOpenChange={v=>{if(!saving&&!processing)setOpen(v);}}><DialogContent className="w-[calc(100%-2rem)] max-w-sm"><DialogTitle>个人资料</DialogTitle><DialogDescription className="sr-only">更改你的头像与昵称</DialogDescription>
 <div className="flex flex-col items-center gap-3 py-3"><Button variant="ghost" aria-label="更改头像" title="更改头像" className="size-24 rounded-full p-2" disabled={saving||processing} onClick={()=>upload.current?.click()}><ProfileAvatar profile={draft} large/></Button><div className="flex gap-2"><Button variant="outline" size="sm" disabled={saving||processing} onClick={()=>upload.current?.click()}>{processing?<LoaderCircleIcon className="size-4 animate-spin"/>:<CameraIcon className="size-4"/>}更改头像</Button>{draft.avatar&&<Button variant="ghost" size="icon-sm" title="移除头像" aria-label="移除头像" disabled={saving||processing} onClick={()=>setDraft(v=>({...v,avatar:''}))}><Trash2Icon className="size-4"/></Button>}</div>
 <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="上传头像" onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setProcessing(true);try{const avatar=await prepareProfileAvatar(file);setDraft(v=>({...v,avatar}));}catch(error){toast.error(error instanceof Error?error.message:'图片读取失败');}finally{setProcessing(false);}}}/></div>
 <div className="space-y-2"><Label htmlFor={id}>昵称</Label><Input id={id} value={draft.nickname} maxLength={40} disabled={saving} onChange={e=>setDraft(v=>({...v,nickname:e.target.value}))}/></div><DialogFooter><Button variant="ghost" disabled={saving||processing} onClick={()=>setOpen(false)}>取消</Button><Button disabled={saving||processing||!draft.nickname.trim()} onClick={()=>void save()}>{saving&&<LoaderCircleIcon className="size-4 animate-spin"/>}保存</Button></DialogFooter></DialogContent></Dialog></>;
}