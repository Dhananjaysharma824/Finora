import { z } from 'zod';
import { ALLOWED_CURRENCIES, MAX_MONEY_MAJOR } from '../../utils/money.js';

const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Invalid ISO date format');

export const createTransactionSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(100),
    amount: z
      .number()
      .finite('Amount must be finite')
      .positive('Amount must be positive')
      .max(MAX_MONEY_MAJOR, 'Amount exceeds safe bounds'),
    type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
    currency: z.enum(ALLOWED_CURRENCIES).default('INR'),
    accountId: z.string().uuid('Invalid account ID'),
    toAccountId: z.string().uuid('Invalid destination account ID').optional(),
    categoryId: z.string().uuid('Invalid category ID'),
    date: isoDateString,
    notes: z.string().trim().max(400).optional(),
    idempotencyKey: z.string().trim().min(8).max(128).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'TRANSFER') {
      if (!data.toAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Destination account is required for transfers',
          path: ['toAccountId'],
        });
      } else if (data.toAccountId === data.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Source and destination accounts must be different',
          path: ['toAccountId'],
        });
      }
    }
  });

export const updateTransactionSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  amount: z.number().finite().positive().max(MAX_MONEY_MAJOR).optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  currency: z.enum(ALLOWED_CURRENCIES).optional(),
  accountId: z.string().uuid().optional(),
  toAccountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().optional(),
  date: isoDateString.optional(),
  notes: z.string().trim().max(400).nullable().optional(),
});

export const listTransactionsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sortBy: z.enum(['date', 'amount', 'title', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const importTransactionsSchema = z.object({
  items: z.array(createTransactionSchema).min(1).max(500),
});
