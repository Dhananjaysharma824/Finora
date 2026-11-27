export const MAX_MONEY_MAJOR = 1_000_000_000;
export const ALLOWED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'] as const;
export type SupportedCurrency = (typeof ALLOWED_CURRENCIES)[number];

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new RangeError('Monetary amount must be finite');
  }
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_MONEY_MAJOR * 100) {
    throw new RangeError('Monetary amount exceeds safe bounds');
  }
  return cents;
}

export function decimalToCents(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function centsToMajor(cents: number): number {
  return Math.round(cents) / 100;
}

export function sanitizeCsvCell(value: string): string {
  const cleaned = value.replace(/\r?\n/g, ' ');
  const neutralized = /^[=+\-@\t\r]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return `"${neutralized.replace(/"/g, '""')}"`;
}
