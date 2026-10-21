import { describe, expect, it } from 'vitest';
import { verifyWecomSignature, wecomDecrypt, wecomEncrypt, wecomSignature, xmlField } from '@/lib/wechat-kf/crypto.server';
import { customerTexts } from '@/lib/wechat-kf/api.server';

const AES = 'jWmYm7qr5nMoAUwZRjGtBxmz3KA1tkAj3ykkR6q2B2C';
const CORP = 'ww1234567890';

describe('WeCom callback crypto', () => {
  it('round-trips a message bound to its CorpId', () => {
    const enc = wecomEncrypt(AES, '<xml><Token><![CDATA[abc]]></Token></xml>', CORP);
    expect(xmlField(wecomDecrypt(AES, enc, CORP), 'Token')).toBe('abc');
  });
  it('rejects a message encrypted for another enterprise', () => {
    const enc = wecomEncrypt(AES, 'hi', 'wwother');
    expect(() => wecomDecrypt(AES, enc, CORP)).toThrow();
  });
  it('accepts only the matching signature', () => {
    const sig = wecomSignature('tok', '1', 'n', 'payload');
    expect(verifyWecomSignature(sig, 'tok', '1', 'n', 'payload')).toBe(true);
    expect(verifyWecomSignature(sig, 'other', '1', 'n', 'payload')).toBe(false);
  });
});

describe('WeChat customer messages', () => {
  it('replies only to customer text messages, never to our own sends', () => {
    const base = { msgid: '1', open_kfid: 'wk', external_userid: 'u' };
    const out = customerTexts([
      { ...base, origin: 3, msgtype: 'text', text: { content: '你好' } },
      { ...base, origin: 5, msgtype: 'text', text: { content: 'bot reply' } },
      { ...base, origin: 4, msgtype: 'event' },
    ]);
    expect(out.map(m => m.text?.content)).toEqual(['你好']);
  });
});
