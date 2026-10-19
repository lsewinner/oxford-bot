import {fireEvent,render,screen,waitFor,cleanup} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import type {User} from '@supabase/supabase-js';
import {accountProfile,profileMetadata} from '@/lib/account-profile';
import {AccountProfile} from '@/components/chat/account-profile';
const mocks=vi.hoisted(()=>({update:vi.fn(),unsubscribe:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{updateUser:mocks.update,onAuthStateChange:()=>({data:{subscription:{unsubscribe:mocks.unsubscribe}}})}}}));
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn()}}));
const user:User={id:'owner',email:'long-private-email@example.com',user_metadata:{full_name:'Michael Hu'},app_metadata:{},aud:'authenticated',created_at:'2026-01-01T00:00:00Z'};
beforeEach(()=>vi.clearAllMocks());afterEach(cleanup);
describe('account identity',()=>{
 it('uses nickname before provider name, never falls back to email',()=>{expect(accountProfile({oxford_nickname:'昵称',full_name:'Michael'}).nickname).toBe('昵称');expect(accountProfile({name:'long@example.com'}).nickname).toBe('我的账户');});
 it('retains a deliberately removed provider avatar',()=>expect(accountProfile({oxford_avatar:'',avatar_url:'https://example.com/photo.jpg'}).avatar).toBe(''));
 it('saves only display metadata, without roles or email',()=>expect(profileMetadata({nickname:' 新昵称 ',avatar:''})).toEqual({oxford_nickname:'新昵称',oxford_avatar:''}));
 it('saves through the signed-in user and restores the returned nickname',async()=>{
  mocks.update.mockResolvedValue({data:{user:{...user,user_metadata:{oxford_nickname:'新昵称',oxford_avatar:''}}},error:null});
  const first=render(<AccountProfile user={user} onSignOut={()=>{}}/>);
  expect(screen.queryByText(user.email??'')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'编辑个人资料'}));fireEvent.change(screen.getByLabelText('昵称'),{target:{value:'新昵称'}});fireEvent.click(screen.getByRole('button',{name:'保存'}));
  await waitFor(()=>expect(mocks.update).toHaveBeenCalledWith({data:{oxford_nickname:'新昵称',oxford_avatar:''}}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect(screen.getByRole('button',{name:'编辑个人资料'}).textContent).toContain('新昵称');
  first.unmount();render(<AccountProfile user={{...user,user_metadata:{oxford_nickname:'新昵称',oxford_avatar:''}}} onSignOut={()=>{}}/>);expect(screen.getByRole('button',{name:'编辑个人资料'}).textContent).toContain('新昵称');
 });
 it('keeps the old identity and dialog when saving fails',async()=>{mocks.update.mockResolvedValue({data:{user:null},error:new Error('保存失败')});render(<AccountProfile user={user} onSignOut={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'编辑个人资料'}));fireEvent.change(screen.getByLabelText('昵称'),{target:{value:'未保存'}});fireEvent.click(screen.getByRole('button',{name:'保存'}));await waitFor(()=>expect(mocks.update).toHaveBeenCalled());await waitFor(()=>expect(screen.getByRole('button',{name:'保存'}).hasAttribute('disabled')).toBe(false));expect(screen.getByRole('dialog')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'取消'}));expect(screen.getByRole('button',{name:'编辑个人资料'}).textContent).toContain('Michael Hu');});
});