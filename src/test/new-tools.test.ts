import { describe, expect, it } from 'vitest';
import { PROVIDERS, isWrite, validateOperation } from '@/lib/connections/catalog';
import { normaliseSymbol } from '@/lib/ai/market.server';

const SHEET = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms';

describe('new tools', () => {
  it('Google Sheets writes need confirmation, reads do not', () => {
    expect(isWrite('sheet_append')).toBe(true);
    expect(isWrite('sheet_update')).toBe(true);
    expect(isWrite('sheet_read')).toBe(false);
  });
  it('Google Sheets is read-only until branding review passes', () => {
    expect(PROVIDERS.google_drive.scopes).toContain('https://www.googleapis.com/auth/spreadsheets.readonly');
    expect(PROVIDERS.google_drive.scopes).not.toContain('https://www.googleapis.com/auth/spreadsheets');
    expect(() => validateOperation('google_drive', { operation: 'sheet_append', id: SHEET, repo: 'Sheet1!A1:B2', text: '[["a",1]]' })).toThrow();
    expect(validateOperation('google_drive', { operation: 'sheet_read', id: SHEET, repo: 'Sheet1!A1:B2' }).operation).toBe('sheet_read');
  });
  it('Discord posts need confirmation and a channel ID', () => {
    expect(isWrite('send_message')).toBe(true);
    expect(() => validateOperation('discord', { operation: 'send_message', id: 'general', text: 'hi' })).toThrow();
  });
  it('X is read-only', () => {
    expect(() => validateOperation('x', { operation: 'post_tweet' as never, text: 'hi' })).toThrow();
    expect(() => validateOperation('x', { operation: 'user_tweets', repo: 'not a user!' })).toThrow();
  });
  it('normalises market shorthand', () => {
    expect(normaliseSymbol('btc')).toBe('BTC-USD');
    expect(normaliseSymbol('700.HK')).toBe('0700.HK');
    expect(normaliseSymbol('600519.SH')).toBe('600519.SS');
  });
});
