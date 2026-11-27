import { z } from 'zod';
import type { FinoraPersistedData } from '@/types/finance';
import { safeJsonParse } from '@/lib/utils';
import { MAX_AMOUNT_PAISE } from '@/utils/money';

const STORAGE_KEY = 'finora_app_state';
export const CURRENT_SCHEMA_VERSION = 1;

export interface StorageRepository {
  load: () => FinoraPersistedData | null;
  save: (data: FinoraPersistedData) => void;
  clear: () => void;
}

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const monthKeyRegex = /^\d{4}-\d{2}$/;

const nonNegPaise = z.number().int().min(0).max(MAX_AMOUNT_PAISE);
const posPaise = z.number().int().min(1).max(MAX_AMOUNT_PAISE);
const signedPaise = z.number().int().min(-MAX_AMOUNT_PAISE).max(MAX_AMOUNT_PAISE);

const categoryEnum = z.enum([
  'salary',
  'freelance',
  'investments',
  'other_income',
  'food',
  'shopping',
  'transportation',
  'housing',
  'utilities',
  'entertainment',
  'healthcare',
  'education',
  'other',
  'transfer',
]);

const expenseCategoryEnum = z.enum([
  'food',
  'shopping',
  'transportation',
  'housing',
  'utilities',
  'entertainment',
  'healthcare',
  'education',
  'other',
]);

const persistedDataSchema = z.object({
  version: z.literal(CURRENT_SCHEMA_VERSION),
  profile: z.object({
    name: z.string().min(1).max(80),
    email: z.string().email().max(120),
    role: z.string().max(80),
    avatarUrl: z.string().max(300).optional(),
  }),
  preferences: z.object({
    currency: z.enum(['INR', 'USD', 'EUR', 'GBP']),
    dateFormat: z.enum(['dd MMM yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']),
    numberFormat: z.enum(['en-IN', 'en-US']),
    defaultDateRange: z.enum(['this_month', 'last_3_months', 'this_year']),
    theme: z.enum(['light', 'dark', 'system']),
    alerts: z.object({
      budgetAlerts: z.boolean(),
      paymentReminders: z.boolean(),
      savingsMilestones: z.boolean(),
    }),
  }),
  accounts: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        name: z.string().min(1).max(60),
        type: z.enum(['bank', 'savings', 'cash', 'wallet']),
        openingBalancePaise: signedPaise,
        institution: z.string().max(60).optional(),
        lastFour: z.string().max(4).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
        createdAt: z.string().max(40),
      }),
    )
    .max(100),
  transactions: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        title: z.string().min(1).max(100),
        amountPaise: posPaise,
        type: z.enum(['income', 'expense', 'transfer']),
        category: categoryEnum,
        accountId: z.string().min(1).max(60),
        toAccountId: z.string().max(60).optional(),
        date: z.string().regex(isoDateRegex),
        notes: z.string().max(400).optional(),
        recurringId: z.string().max(60).optional(),
        goalId: z.string().max(60).optional(),
        createdAt: z.string().max(40),
        updatedAt: z.string().max(40),
      }),
    )
    .max(10000),
  budgets: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        category: expenseCategoryEnum,
        limitPaise: posPaise,
        month: z.string().regex(monthKeyRegex),
        description: z.string().max(200).optional(),
        createdAt: z.string().max(40),
      }),
    )
    .max(500),
  goals: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        title: z.string().min(1).max(80),
        targetPaise: posPaise,
        currentPaise: nonNegPaise,
        deadline: z.string().regex(isoDateRegex),
        accountId: z.string().max(60).optional(),
        notes: z.string().max(240).optional(),
        createdAt: z.string().max(40),
      }),
    )
    .max(200),
  recurringPayments: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        title: z.string().min(1).max(80),
        amountPaise: posPaise,
        category: expenseCategoryEnum,
        accountId: z.string().min(1).max(60),
        frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
        nextPaymentDate: z.string().regex(isoDateRegex),
        isActive: z.boolean(),
        notes: z.string().max(240).optional(),
        lastPaidDate: z.string().regex(isoDateRegex).optional(),
        createdAt: z.string().max(40),
      }),
    )
    .max(200),
  notifications: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        type: z.enum([
          'budget_warning',
          'budget_exceeded',
          'recurring_upcoming',
          'goal_milestone',
          'transaction_created',
          'transaction_updated',
        ]),
        title: z.string().min(1).max(120),
        message: z.string().min(1).max(300),
        read: z.boolean(),
        createdAt: z.string().max(40),
        linkTo: z.string().max(120).optional(),
      }),
    )
    .max(200),
});

export function validatePersistedData(value: unknown): FinoraPersistedData | null {
  const result = persistedDataSchema.safeParse(value);
  if (!result.success) return null;
  return result.data;
}

export const localStorageRepository: StorageRepository = {
  load() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw || raw.length > 5_000_000) return null;
      const parsed = safeJsonParse(raw);
      return validatePersistedData(parsed);
    } catch {
      return null;
    }
  },
  save(data) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore quota or private-browsing storage errors
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  },
};
