import { describe, expect, it } from 'vitest';
import {
  generateId,
  isSafeInternalRoute,
  safeJsonParse,
  sanitizeCsvCell,
} from '@/lib/utils';
import { isValidMajorAmount, isValidPaise, MAX_AMOUNT_MAJOR, toPaise } from '@/utils/money';
import { validatePersistedData } from '@/services/storage';
import { createDemoData } from '@/mocks/demoData';

describe('Finora security regression suite', () => {
  it('rejects NaN, Infinity, negative, and overflowing monetary amounts', () => {
    expect(() => toPaise(Number.NaN)).toThrow();
    expect(() => toPaise(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => toPaise(MAX_AMOUNT_MAJOR + 1)).toThrow();

    expect(isValidMajorAmount(-10)).toBe(false);
    expect(isValidMajorAmount(0)).toBe(false);
    expect(isValidMajorAmount(0, true)).toBe(true);
    expect(isValidMajorAmount(Number.NaN)).toBe(false);
    expect(isValidMajorAmount(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isValidMajorAmount(MAX_AMOUNT_MAJOR + 1)).toBe(false);

    expect(isValidPaise(-100)).toBe(false);
    expect(isValidPaise(100.5)).toBe(false);
    expect(isValidPaise(100)).toBe(true);
  });

  it('neutralizes CSV formula injection (CWE-1236)', () => {
    expect(sanitizeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(sanitizeCsvCell('+1+1')).toBe('"\'+1+1"');
    expect(sanitizeCsvCell('-2+3')).toBe('"\'-2+3"');
    expect(sanitizeCsvCell('@SUM(A1:A2)')).toBe('"\'@SUM(A1:A2)"');
    expect(sanitizeCsvCell('Grocery Shopping')).toBe('"Grocery Shopping"');
  });

  it('validates internal navigation routes safely', () => {
    expect(isSafeInternalRoute('/budgets')).toBe(true);
    expect(isSafeInternalRoute('/transactions?category=food')).toBe(true);
    expect(isSafeInternalRoute('//evil.example.com')).toBe(false);
    expect(isSafeInternalRoute('https://evil.example.com')).toBe(false);
    expect(isSafeInternalRoute('javascript:alert(1)')).toBe(false);
    expect(isSafeInternalRoute(undefined)).toBe(false);
  });

  it('strips prototype pollution keys during JSON parsing', () => {
    const malicious = '{"name":"Alex","__proto__":{"polluted":true},"constructor":{"x":1}}';
    const parsed = safeJsonParse(malicious) as Record<string, unknown>;
    expect(parsed.name).toBe('Alex');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(parsed, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'constructor')).toBe(false);
  });

  it('validates persisted storage schema strictly and rejects tampered records', () => {
    const valid = createDemoData();
    expect(validatePersistedData(valid)).not.toBeNull();

    const tamperedNegativeTx = {
      ...valid,
      transactions: [
        {
          ...valid.transactions[0],
          amountPaise: -5000,
        },
      ],
    };
    expect(validatePersistedData(tamperedNegativeTx)).toBeNull();

    const tamperedBadVersion = { ...valid, version: 999 };
    expect(validatePersistedData(tamperedBadVersion)).toBeNull();

    const tamperedInvalidDate = {
      ...valid,
      transactions: [{ ...valid.transactions[0], date: 'not-a-date' }],
    };
    expect(validatePersistedData(tamperedInvalidDate)).toBeNull();
  });

  it('generates unique prefixed IDs using crypto', () => {
    const a = generateId('tx');
    const b = generateId('tx');
    expect(a.startsWith('tx_')).toBe(true);
    expect(b.startsWith('tx_')).toBe(true);
    expect(a).not.toBe(b);
  });
});
