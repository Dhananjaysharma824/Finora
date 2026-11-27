import { z } from 'zod';
import { MAX_MONEY_MAJOR } from '../../utils/money.js';

export const createBudgetSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  limitAmount: z
    .number()
    .finite()
    .positive('Budget limit must be positive')
    .max(MAX_MONEY_MAJOR),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
  description: z.string().trim().max(200).optional(),
});

export const updateBudgetSchema = z.object({
  limitAmount: z.number().finite().positive().max(MAX_MONEY_MAJOR).optional(),
  description: z.string().trim().max(200).nullable().optional(),
});
