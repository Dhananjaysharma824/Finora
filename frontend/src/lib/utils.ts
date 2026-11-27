import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${prefix}_${hex}`;
  }
  throw new Error('Cryptographically secure random generator is unavailable');
}

/**
 * Neutralizes spreadsheet formula injection (CWE-1236) in CSV exports
 * by prefixing leading =, +, -, @, tab, or carriage return with a single quote.
 */
export function sanitizeCsvCell(value: string): string {
  const cleaned = value.replace(/\r?\n/g, ' ');
  const neutralized = /^[=+\-@\t\r]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

/**
 * Validates that a navigation path is a safe internal relative route.
 */
export function isSafeInternalRoute(path: string | undefined): path is string {
  if (!path) return false;
  return path.startsWith('/') && !path.startsWith('//') && !path.includes(':');
}

/**
 * Parses JSON safely while stripping prototype-pollution keys (__proto__, constructor, prototype).
 */
export function safeJsonParse(raw: string): unknown {
  return JSON.parse(raw, (key, value: unknown) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined;
    }
    return value;
  });
}
