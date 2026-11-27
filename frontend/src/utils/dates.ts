import { format, parseISO, isValid, startOfMonth, endOfMonth, subMonths, addWeeks, addMonths, addQuarters, addYears } from 'date-fns';
import type { DateFormatOption, RecurringFrequency } from '@/types/finance';

export function formatDisplayDate(
  dateStr: string,
  dateFormat: DateFormatOption = 'dd MMM yyyy',
): string {
  const parsed = parseISO(dateStr);
  if (!isValid(parsed)) return dateStr;
  return format(parsed, dateFormat);
}

export function getMonthKey(date: Date = new Date()): string {
  return format(date, 'yyyy-MM');
}

export function getMonthLabel(monthKey: string): string {
  const parsed = parseISO(`${monthKey}-01`);
  if (!isValid(parsed)) return monthKey;
  return format(parsed, 'MMMM yyyy');
}

export function getRecentMonthKeys(count: number, referenceDate: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    keys.push(format(subMonths(referenceDate, i), 'yyyy-MM'));
  }
  return keys;
}

export function getMonthBounds(monthKey: string): { start: string; end: string } {
  const parsed = parseISO(`${monthKey}-01`);
  return {
    start: format(startOfMonth(parsed), 'yyyy-MM-dd'),
    end: format(endOfMonth(parsed), 'yyyy-MM-dd'),
  };
}

export function advanceRecurringDate(dateStr: string, frequency: RecurringFrequency): string {
  const parsed = parseISO(dateStr);
  if (!isValid(parsed)) return dateStr;
  switch (frequency) {
    case 'weekly':
      return format(addWeeks(parsed, 1), 'yyyy-MM-dd');
    case 'monthly':
      return format(addMonths(parsed, 1), 'yyyy-MM-dd');
    case 'quarterly':
      return format(addQuarters(parsed, 1), 'yyyy-MM-dd');
    case 'yearly':
      return format(addYears(parsed, 1), 'yyyy-MM-dd');
  }
}

export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
