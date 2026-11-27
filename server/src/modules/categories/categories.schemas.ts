import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(40),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,40}$/, 'Slug must contain lowercase letters, numbers, - or _')
    .optional(),
  type: z.enum(['INCOME', 'EXPENSE']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#2F765B'),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});
