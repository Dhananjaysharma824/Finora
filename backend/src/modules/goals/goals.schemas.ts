import { z } from 'zod';
import { MAX_MONEY_MAJOR } from '../../utils/money.js';

export const createGoalSchema = z.object({
  title: z.string().trim().min(1, 'Goal title is required').max(80),
  targetAmount: z.number().finite().positive('Target must be positive').max(MAX_MONEY_MAJOR),
  currentAmount: z.number().finite().min(0).max(MAX_MONEY_MAJOR).default(0),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Invalid deadline date'),
  linkedAccountId: z.string().uuid().optional(),
  notes: z.string().trim().max(240).optional(),
});

export const updateGoalSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  targetAmount: z.number().finite().positive().max(MAX_MONEY_MAJOR).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/).optional(),
  linkedAccountId: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(240).nullable().optional(),
});

export const contributeGoalSchema = z.object({
  amount: z.number().finite().positive('Contribution must be positive').max(MAX_MONEY_MAJOR),
  sourceAccountId: z.string().uuid().optional(),
  notes: z.string().trim().max(200).optional(),
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
});
