import { describe, expect, it } from 'vitest';
import { isWrite, validateOperation } from '@/lib/connections/catalog';
import { parseOandaCredential, oandaHost } from '@/lib/connections/personal-token.server';

const acct = '101-004-1234567-001';

describe('OANDA connection', () => {
  it('treats every trade action as a confirmed write', () => {
    for (const op of ['create_order', 'close_position', 'close_trade', 'cancel_order']) expect(isWrite(op)).toBe(true);
    for (const op of ['accounts', 'summary', 'positions', 'prices']) expect(isWrite(op)).toBe(false);
  });
  it('rejects a long order whose stop loss is above the entry price', () => {
    expect(() => validateOperation('oanda', { operation: 'create_order', id: acct, repo: 'XAU_USD', units: '10', orderType: 'LIMIT', price: '2380', stopLoss: '2390' })).toThrow('止损');
    expect(validateOperation('oanda', { operation: 'create_order', id: acct, repo: 'XAU_USD', units: '10', orderType: 'LIMIT', price: '2380', stopLoss: '2370', takeProfit: '2400' }).units).toBe('10');
  });
  it('requires non-zero units and a valid account', () => {
    expect(() => validateOperation('oanda', { operation: 'create_order', id: acct, repo: 'EUR_USD', units: '0' })).toThrow();
    expect(() => validateOperation('oanda', { operation: 'summary', id: 'abc' })).toThrow();
  });
  it('uses only the fixed practice or live host', () => {
    expect(oandaHost(parseOandaCredential('practice|abcdef0123456789abcdef-0123').env)).toBe('https://api-fxpractice.oanda.com');
    expect(oandaHost(parseOandaCredential('live|abcdef0123456789abcdef-0123').env)).toBe('https://api-fxtrade.oanda.com');
    expect(() => parseOandaCredential('evil.com|abcdef0123456789abcdef')).toThrow();
  });
});
