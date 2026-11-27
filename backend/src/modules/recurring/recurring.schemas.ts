import { z } from 'zod';
import { MAX_MONEY_MAJOR } from '../../utils/money.js';

export const createRecurringSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(80),
  amount: z.number().finite().positive('Amount must be positive').max(MAX_MONEY_MAJOR),
  accountId: z.string().uuid('Invalid account ID'),
  categoryId: z.string().uuid('Invalid category ID'),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  nextPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Invalid date'),
  isActive: z.boolean().default(true),
  notes: z.string().trim().max(240).optional(),
});

export const updateRecurringSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  amount: z.number().finite().positive().max(MAX_MONEY_MAJOR).optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  nextPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(240).nullable().optional(),
});
