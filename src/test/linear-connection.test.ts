import { describe, expect, it } from 'vitest';
import { PROVIDERS, providerId, isWrite, validateOperation } from '@/lib/connections/catalog';

describe('linear connection catalog', () => {
  it('offers team, issue list, issue detail and two confirmed writes', () => {
    expect(providerId.options).toContain('linear');
    expect([...PROVIDERS.linear.operations]).toEqual(['teams', 'issues', 'issue', 'create_issue', 'create_comment']);
  });

  it('counts commenting as a write that needs confirmation', () => {
    expect(isWrite('create_comment')).toBe(true);
    expect(isWrite('issues')).toBe(false);
    expect(isWrite('issue')).toBe(false);
  });

  it('asks for the issue reference before reading or commenting', () => {
    expect(() => validateOperation('linear', { operation: 'issue' })).toThrow('问题编号');
    expect(() => validateOperation('linear', { operation: 'create_comment', id: 'ENG-1' })).toThrow('评论内容');
  });

  it('asks for the team before creating an issue', () => {
    expect(() => validateOperation('linear', { operation: 'create_issue', title: '标题', text: '正文' })).toThrow('teamId');
  });

  it('refuses operations Linear was not given', () => {
    expect(() => validateOperation('linear', { operation: 'delete_issue' })).toThrow('不支持的操作');
  });
});
