import { describe, expect, it } from 'vitest';
import { PROVIDERS, validateOperation } from '@/lib/connections/catalog';

describe('Google Drive connection', () => {
  it('offers browsing, search, reading and confirmed file creation', () => {
    expect(PROVIDERS.google_drive.operations).toEqual(['search', 'folders', 'read', 'create_file']);
    expect(() => validateOperation('google_drive', { operation: 'folders' })).not.toThrow();
    expect(() => validateOperation('google_drive', { operation: 'folders', id: '1Ab_-9' })).not.toThrow();
  });
  it('requires a file id before reading a document', () => {
    expect(() => validateOperation('google_drive', { operation: 'read' })).toThrow('缺少文件、邮件或频道标识');
  });
  it('requires both title and body before creating a file', () => {
    expect(() => validateOperation('google_drive', { operation: 'create_file', title: '纪要' })).toThrow('请提供标题和内容');
  });
  it('keeps Drive read-only scopes plus app-created file writes', () => {
    expect(PROVIDERS.google_drive.scopes).toContain('https://www.googleapis.com/auth/drive.readonly');
    expect(PROVIDERS.google_drive.scopes).not.toContain('https://www.googleapis.com/auth/drive');
  });
});
