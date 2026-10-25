import { tz } from "@/lib/i18n";
import { useEffect,useId,useRef,useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { UserRoundIcon,CameraIcon,LoaderCircleIcon,LogOutIcon,Trash2Icon,FlameIcon,SparklesIcon,ShieldCheckIcon,DownloadIcon,PencilIcon,ChevronsUpDownIcon,SunriseIcon,NotebookPenIcon,AudioLinesIcon,LayoutGridIcon } from 'lucide-react';
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
function ProfileAvatar({profile,large=false}:{profile:Profile;large?:boolean}){return <Avatar className={large?'size-20':'size-9'}><AvatarImage src={profile.avatar} alt={profile.nickname} className="object-cover"/><AvatarFallback className={large?'text-2xl':'text-sm'}>{profile.nickname==='我的账户'?<UserRoundIcon className={large?'size-9':'size-4'}/>:Array.from(profile.nickname).slice(0,2).join('')}</AvatarFallback></Avatar>;}
export function AccountProfile({user,onSignOut,isAdmin=false}:{user:User;onSignOut:()=>void|Promise<void>;isAdmin?:boolean}){
 const {isPro,plan,openUpgrade}=usePro();const tier=plan==='ultra'?'Ultra':'Pro';const desk=useDesktopInstall();const [trends,setTrends]=useState(false);
 const [profile,setProfile]=useState(()=>accountProfile(user.user_metadata));const [draft,setDraft]=useState(profile),[open,setOpen]=useState(false),[saving,setSaving]=useState(false),[processing,setProcessing]=useState(false);const upload=useRef<HTMLInputElement>(null);const id=useId();
 useEffect(()=>{setProfile(accountProfile(user.user_metadata));},[user.id,user.user_metadata]);
 useEffect(()=>{const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='USER_UPDATED'&&session?.user.id===user.id)setProfile(accountProfile(session.user.user_metadata));});return ()=>data.subscription.unsubscribe();},[user.id]);
 const save=async()=>{setSaving(true);try{const {data,error}=await supabase.auth.updateUser({data:profileMetadata(draft)});if(error)throw error;if(!data.user)throw new Error(tz("登录已失效，请重新登录"));setProfile(accountProfile(data.user.user_metadata));setOpen(false);toast.success(tz("个人资料已保存"));}catch(error){toast.error(error instanceof Error?error.message:tz("保存失败，请重试"));}finally{setSaving(false);}};
 return <><div className="shrink-0 border-t border-sidebar-border px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" aria-label={tz("账户菜单")} className="h-14 w-full justify-start gap-3 px-2"><ProfileAvatar profile={profile}/><span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{profile.nickname}</span>{isPro&&<span className="rounded border border-border px-1.5 text-[10px] font-semibold">{tier.toUpperCase()}</span>}<ChevronsUpDownIcon className="size-4 text-muted-foreground"/></Button></DropdownMenuTrigger>
 <DropdownMenuContent side="top" align="start" className="w-64">
  <DropdownMenuLabel className="flex items-center gap-3 py-2"><ProfileAvatar profile={profile}/><span className="min-w-0"><span className="block truncate text-sm">{profile.nickname}</span><span className="block text-xs font-normal text-muted-foreground">{isPro?`Oxford ${tier}`:'Free'}</span></span></DropdownMenuLabel><DropdownMenuSeparator/>
  <DropdownMenuItem onSelect={()=>setTrends(true)}><FlameIcon/>{tz("实时热点")}</DropdownMenuItem>
  <DropdownMenuItem asChild><Link to="/briefing"><SunriseIcon/>{tz("主动早报")}</Link></DropdownMenuItem>
  <DropdownMenuItem asChild><Link to="/meetings"><NotebookPenIcon/>{tz("会议助手")}</Link></DropdownMenuItem>
  <DropdownMenuItem asChild><Link to="/voice"><AudioLinesIcon/>{tz("实时语音")}</Link></DropdownMenuItem>
  <DropdownMenuItem asChild><Link to="/bots"><LayoutGridIcon/>{tz("Bot 广场")}</Link></DropdownMenuItem>
  <DropdownMenuItem onSelect={()=>openUpgrade('general')}><SparklesIcon/>{isPro?tz("Oxford {0} · 管理订阅", tier):tz("升级到 Pro")}</DropdownMenuItem>
  {isAdmin&&<DropdownMenuItem asChild><Link to="/admin"><ShieldCheckIcon/>{tz("管理后台")}</Link></DropdownMenuItem>}
  <DropdownMenuItem disabled={desk.installed||desk.busy} onSelect={()=>desk.install()}><DownloadIcon/>{desk.installed?tz("已安装桌面端"):tz("安装桌面端")}</DropdownMenuItem>
  <DropdownMenuItem onSelect={()=>{setDraft(profile);setOpen(true);}}><PencilIcon/>{tz("修改资料")}</DropdownMenuItem><DropdownMenuSeparator/>
  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={()=>void onSignOut()}><LogOutIcon/>{tz("退出登录")}</DropdownMenuItem>
 </DropdownMenuContent></DropdownMenu></div>
 <TrendsDrawer open={trends} onOpenChange={setTrends}/>
 <Dialog open={open} onOpenChange={v=>{if(!saving&&!processing)setOpen(v);}}><DialogContent className="w-[calc(100%-2rem)] max-w-sm"><DialogTitle>{tz("个人资料")}</DialogTitle><DialogDescription className="sr-only">{tz("更改你的头像与昵称")}</DialogDescription>
 <div className="flex flex-col items-center gap-3 py-3"><Button variant="ghost" aria-label={tz("更改头像")} title={tz("更改头像")} className="size-24 rounded-full p-2" disabled={saving||processing} onClick={()=>upload.current?.click()}><ProfileAvatar profile={draft} large/></Button><div className="flex gap-2"><Button variant="outline" size="sm" disabled={saving||processing} onClick={()=>upload.current?.click()}>{processing?<LoaderCircleIcon className="size-4 animate-spin"/>:<CameraIcon className="size-4"/>}{tz("更改头像")}</Button>{draft.avatar&&<Button variant="ghost" size="icon-sm" title={tz("移除头像")} aria-label={tz("移除头像")} disabled={saving||processing} onClick={()=>setDraft(v=>({...v,avatar:''}))}><Trash2Icon className="size-4"/></Button>}</div>
 <input ref={upload} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label={tz("上传头像")} onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setProcessing(true);try{const avatar=await prepareProfileAvatar(file);setDraft(v=>({...v,avatar}));}catch(error){toast.error(error instanceof Error?error.message:tz("图片读取失败"));}finally{setProcessing(false);}}}/></div>
 <div className="space-y-2"><Label htmlFor={id}>{tz("昵称")}</Label><Input id={id} value={draft.nickname} maxLength={40} disabled={saving} onChange={e=>setDraft(v=>({...v,nickname:e.target.value}))}/></div><DialogFooter><Button variant="ghost" disabled={saving||processing} onClick={()=>setOpen(false)}>{tz("取消")}</Button><Button disabled={saving||processing||!draft.nickname.trim()} onClick={()=>void save()}>{saving&&<LoaderCircleIcon className="size-4 animate-spin"/>}{tz("保存")}</Button></DialogFooter></DialogContent></Dialog></>;
}