import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { authenticateUser, csrfProtection } from '../../middleware/auth.js';
import { ALLOWED_CURRENCIES } from '../../utils/money.js';

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
});

const updatePreferencesSchema = z.object({
  currency: z.enum(ALLOWED_CURRENCIES).optional(),
  dateFormat: z.enum(['dd MMM yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']).optional(),
  numberFormat: z.enum(['en-IN', 'en-US']).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

export const usersRouter = Router();
usersRouter.use(authenticateUser);

usersRouter.patch('/profile', csrfProtection, async (req, res, next) => {
  try {
    const input = updateProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        currency: true,
        dateFormat: true,
        numberFormat: true,
        theme: true,
        timezone: true,
      },
    });
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
});

usersRouter.patch('/preferences', csrfProtection, async (req, res, next) => {
  try {
    const input = updatePreferencesSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.dateFormat !== undefined ? { dateFormat: input.dateFormat } : {}),
        ...(input.numberFormat !== undefined ? { numberFormat: input.numberFormat } : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        currency: true,
        dateFormat: true,
        numberFormat: true,
        theme: true,
        timezone: true,
      },
    });
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
});
