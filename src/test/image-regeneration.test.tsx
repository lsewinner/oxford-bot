import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock('@/lib/stream-image', () => ({ streamImage: mocks.stream }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
import { GeneratedImage } from '@/components/chat/media-card';
describe('image prompt regeneration', () => {
  beforeEach(() => { mocks.stream.mockReset(); });
  it('sends the modified prompt and saves it with the completed image', async () => {
    const complete = vi.fn();
    mocks.stream.mockImplementation(async (_endpoint, _input, frame) => frame('data:image/png;base64,new', true));
    render(<GeneratedImage prompt="原始猫" image="data:image/png;base64,old" autoStart={false} onComplete={complete} />);
    fireEvent.click(screen.getByRole('button', { name: '修改提示词' }));
    fireEvent.change(screen.getByRole('textbox', { name: '图片提示词' }), { target: { value: '红色猫' } });
    fireEvent.click(screen.getByRole('button', { name: '重新生成图片' }));
    await waitFor(() => expect(complete).toHaveBeenCalledWith('data:image/png;base64,new', '红色猫'));
    expect(mocks.stream.mock.calls[0]?.[1]).toEqual({ prompt: '红色猫' });
  });
  it('retains the old successful image when regeneration fails', async () => {
    const complete = vi.fn();
    mocks.stream.mockRejectedValue(new Error('图片服务不可用'));
    render(<GeneratedImage prompt="猫" image="data:image/png;base64,old" autoStart={false} onComplete={complete} />);
    fireEvent.click(screen.getByRole('button', { name: '修改提示词' }));
    fireEvent.click(screen.getByRole('button', { name: '重新生成图片' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('img', { name: 'Oxford-generated.png' })).toHaveAttribute('src', 'data:image/png;base64,old');
    expect(complete).not.toHaveBeenCalled();
  });
});