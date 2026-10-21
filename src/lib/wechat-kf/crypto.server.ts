import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// WeCom callback crypto: SHA1 signature over sorted fields; AES-256-CBC with PKCS7 padded to 32 bytes.
export function wecomSignature(token: string, timestamp: string, nonce: string, encrypted: string): string {
  return createHash('sha1').update([token, timestamp, nonce, encrypted].sort().join('')).digest('hex');
}

export function verifyWecomSignature(signature: string, token: string, timestamp: string, nonce: string, encrypted: string): boolean {
  const expected = Buffer.from(wecomSignature(token, timestamp, nonce, encrypted));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function aesKey(encodingAesKey: string): Buffer {
  const key = Buffer.from(encodingAesKey + '=', 'base64');
  if (key.length !== 32) throw new Error('EncodingAESKey 格式不正确');
  return key;
}

export function wecomDecrypt(encodingAesKey: string, encrypted: string, expectedReceiveId?: string): string {
  const key = aesKey(encodingAesKey);
  const decipher = createDecipheriv('aes-256-cbc', key, key.subarray(0, 16));
  decipher.setAutoPadding(false);
  const raw = Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]);
  const pad = raw[raw.length - 1] ?? 0;
  if (pad < 1 || pad > 32) throw new Error('解密失败');
  const content = raw.subarray(16, raw.length - pad);
  const len = content.readUInt32BE(0);
  const message = content.subarray(4, 4 + len).toString('utf8');
  const receiveId = content.subarray(4 + len).toString('utf8');
  if (expectedReceiveId && receiveId !== expectedReceiveId) throw new Error('企业 ID 不匹配');
  return message;
}

export function wecomEncrypt(encodingAesKey: string, message: string, receiveId: string): string {
  const key = aesKey(encodingAesKey);
  const msg = Buffer.from(message, 'utf8');
  const len = Buffer.alloc(4); len.writeUInt32BE(msg.length, 0);
  const body = Buffer.concat([randomBytes(16), len, msg, Buffer.from(receiveId, 'utf8')]);
  const pad = 32 - (body.length % 32);
  const cipher = createCipheriv('aes-256-cbc', key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(Buffer.concat([body, Buffer.alloc(pad, pad)])), cipher.final()]).toString('base64');
}

export function xmlField(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${name}>`));
  return (m?.[1] ?? m?.[2] ?? '').trim();
}
