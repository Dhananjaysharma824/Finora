import { Router } from 'express';
import { authenticateUser, csrfProtection } from '../../middleware/auth.js';
import { createRecurringSchema, updateRecurringSchema } from './recurring.schemas.js';
import { recurringService } from './recurring.service.js';

export const recurringRouter = Router();

recurringRouter.use(authenticateUser);

recurringRouter.get('/', async (req, res, next) => {
  try {
    const result = await recurringService.list(req.user!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

recurringRouter.get('/upcoming', async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days ?? 14) || 14, 1), 90);
    const items = await recurringService.upcoming(req.user!.id, days);
    res.status(200).json({ items });
  } catch (err) {
    next(err);
  }
});

recurringRouter.post('/', csrfProtection, async (req, res, next) => {
  try {
    const input = createRecurringSchema.parse(req.body);
    const item = await recurringService.create(req.user!.id, input);
    res.status(201).json({ recurringPayment: item });
  } catch (err) {
    next(err);
  }
});

recurringRouter.patch('/:id', csrfProtection, async (req, res, next) => {
  try {
    const input = updateRecurringSchema.parse(req.body);
    const item = await recurringService.update(req.user!.id, String(req.params.id), input);
    res.status(200).json({ recurringPayment: item });
  } catch (err) {
    next(err);
  }
});

recurringRouter.post('/:id/pause', csrfProtection, async (req, res, next) => {
  try {
    const item = await recurringService.setActive(req.user!.id, String(req.params.id), false);
    res.status(200).json({ recurringPayment: item });
  } catch (err) {
    next(err);
  }
});

recurringRouter.post('/:id/resume', csrfProtection, async (req, res, next) => {
  try {
    const item = await recurringService.setActive(req.user!.id, String(req.params.id), true);
    res.status(200).json({ recurringPayment: item });
  } catch (err) {
    next(err);
  }
});

recurringRouter.post('/:id/mark-paid', csrfProtection, async (req, res, next) => {
  try {
    const idempotencyKey = req.get('idempotency-key') ?? undefined;
    const result = await recurringService.markPaid(
      req.user!.id,
      String(req.params.id),
      idempotencyKey,
    );
    res.status(result.deduplicated ? 200 : 201).json(result);
  } catch (err) {
    next(err);
  }
});

recurringRouter.delete('/:id', csrfProtection, async (req, res, next) => {
  try {
    await recurringService.remove(req.user!.id, String(req.params.id));
    res.status(200).json({ message: 'Recurring payment deleted' });
  } catch (err) {
    next(err);
  }
});
