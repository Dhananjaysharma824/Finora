import type { CurrencyCode, NumberFormatOption } from '@/types/finance';

export const MAX_AMOUNT_MAJOR = 1_000_000_000; // 1 billion major units
export const MAX_AMOUNT_PAISE = MAX_AMOUNT_MAJOR * 100; // 100 billion paise (<< Number.MAX_SAFE_INTEGER)

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const EXCHANGE_RATES_FROM_INR: Record<CurrencyCode, number> = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
};

export function isValidMajorAmount(amount: number, allowZero = false): boolean {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return false;
  if (allowZero ? amount < 0 : amount <= 0) return false;
  return amount <= MAX_AMOUNT_MAJOR;
}

export function isValidPaise(paise: number, allowZero = false): boolean {
  if (typeof paise !== 'number' || !Number.isSafeInteger(paise)) return false;
  if (allowZero ? paise < 0 : paise <= 0) return false;
  return paise <= MAX_AMOUNT_PAISE;
}

export function toPaise(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new RangeError('Invalid monetary amount');
  }
  const paise = Math.round(amount * 100);
  if (!Number.isSafeInteger(paise) || Math.abs(paise) > MAX_AMOUNT_PAISE) {
    throw new RangeError('Monetary amount exceeds safe bounds');
  }
  return paise;
}

export function fromPaise(paise: number): number {
  if (!Number.isFinite(paise)) return 0;
  return paise / 100;
}

export function convertFromInrPaise(paise: number, currency: CurrencyCode): number {
  if (!Number.isFinite(paise)) return 0;
  if (currency === 'INR') return paise;
  return Math.round(paise * EXCHANGE_RATES_FROM_INR[currency]);
}

export interface FormatMoneyOptions {
  currency?: CurrencyCode;
  numberFormat?: NumberFormatOption;
  showSign?: boolean;
  compact?: boolean;
  decimals?: number;
}

export function formatMoney(
  paise: number,
  options: FormatMoneyOptions = {},
): string {
  const {
    currency = 'INR',
    numberFormat = 'en-IN',
    showSign = false,
    compact = false,
    decimals = 2,
  } = options;

  const safePaise = Number.isFinite(paise) ? paise : 0;
  const convertedPaise = convertFromInrPaise(safePaise, currency);
  const absMajor = Math.abs(convertedPaise) / 100;
  const isNegative = convertedPaise < 0;

  let formatted: string;
  if (compact) {
    formatted = new Intl.NumberFormat(numberFormat, {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(absMajor);
  } else {
    formatted = new Intl.NumberFormat(numberFormat, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(absMajor);
  }

  const symbol = CURRENCY_SYMBOLS[currency];
  const sign = isNegative ? '-' : showSign && convertedPaise > 0 ? '+' : '';
  return `${sign}${symbol}${formatted}`;
}

export function calculateSavingsRate(incomePaise: number, expensePaise: number): number {
  if (!Number.isFinite(incomePaise) || !Number.isFinite(expensePaise) || incomePaise <= 0) {
    return 0;
  }
  const rate = ((incomePaise - expensePaise) / incomePaise) * 100;
  return Math.round(rate * 10) / 10;
}

export function calculatePercentageChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return Math.round(change * 10) / 10;
}
