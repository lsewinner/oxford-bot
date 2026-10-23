import { describe, expect, it } from 'vitest';
import { buildWorkflowPrompt, workflowRequestSchema, workflowStepLimit, type WorkflowRequest } from '@/lib/workflows';

const request: WorkflowRequest = { id: 'weekly', sources: [{ provider: 'jira', account: 'work', label: '工作' }, { provider: 'telegram', account: 'personal', label: '私人' }], destination: null, details: '', period: 'week' };
describe('multi-tool workflow rules', () => {
  it('accepts multiple real source accounts and preserves their exact selection', () => {
    const parsed = workflowRequestSchema.parse(request);
    expect(parsed.sources).toEqual(request.sources);
    const prompt = buildWorkflowPrompt(request, new Date('2026-10-22T08:29:00Z'));
    expect(prompt).toContain('account="work"');
    expect(prompt).toContain('account="personal"');
    expect(prompt).not.toContain('service_google_mail');
  });
  it('requires a destination and target description for transfer', () => {
    expect(workflowRequestSchema.safeParse({ ...request, id: 'transfer' }).success).toBe(false);
    expect(workflowRequestSchema.safeParse({ ...request, id: 'transfer', destination: request.sources[1], details: '整理后发给我' }).success).toBe(true);
  });
  it('does not allow duplicate sources or read-only write destinations', () => {
    expect(workflowRequestSchema.safeParse({ ...request, sources: [request.sources[0], request.sources[0]] }).success).toBe(false);
    expect(workflowRequestSchema.safeParse({ ...request, destination: { provider: 'cloudflare', account: 'a', label: 'a' } }).success).toBe(false);
  });
  it('limits a workflow to four source accounts', () => {
    expect(workflowRequestSchema.safeParse({ ...request, sources: Array.from({ length: 5 }, (_, i) => ({ provider: 'jira', account: String(i), label: String(i) })) }).success).toBe(false);
  });
  it('requires a meeting name or time before running', () => {
    expect(workflowRequestSchema.safeParse({ ...request, id: 'meeting' }).success).toBe(false);
  });
  it('sets the seven-day reporting range using actual launch time', () => {
    const prompt = buildWorkflowPrompt(request, new Date('2026-10-22T08:29:00Z'));
    expect(prompt).toContain('2026-10-15T08:29:00.000Z 至 2026-10-22T08:29:00.000Z');
  });
  it('reserves a bounded multi-step budget without changing ordinary chat', () => {
    expect(workflowStepLimit(buildWorkflowPrompt(request))).toBe(12);
    expect(workflowStepLimit('普通问题')).toBe(3);
    expect(workflowStepLimit('请提到 [Oxford 工作流 · 工作周报]')).toBe(3);
  });
});