import { z } from 'zod';
import { ALLOWED_CURRENCIES, MAX_MONEY_MAJOR } from '../../utils/money.js';

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, 'Account name is required').max(60),
  type: z.enum(['BANK', 'SAVINGS', 'CASH', 'WALLET']),
  currency: z.enum(ALLOWED_CURRENCIES).default('INR'),
  openingBalance: z
    .number()
    .finite()
    .min(-MAX_MONEY_MAJOR)
    .max(MAX_MONEY_MAJOR)
    .default(0),
  institution: z.string().trim().max(60).optional(),
  lastFour: z.string().trim().regex(/^\d{4}$/, 'Must be 4 digits').optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#153D32'),
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  type: z.enum(['BANK', 'SAVINGS', 'CASH', 'WALLET']).optional(),
  institution: z.string().trim().max(60).nullable().optional(),
  lastFour: z.string().trim().regex(/^\d{4}$/).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});
