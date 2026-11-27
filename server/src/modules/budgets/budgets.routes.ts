import { Router } from 'express';
import { authenticateUser, csrfProtection } from '../../middleware/auth.js';
import { createBudgetSchema, updateBudgetSchema } from './budgets.schemas.js';
import { budgetsService } from './budgets.service.js';

export const budgetsRouter = Router();

budgetsRouter.use(authenticateUser);

budgetsRouter.get('/', async (req, res, next) => {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const budgets = await budgetsService.list(req.user!.id, month);
    res.status(200).json({ budgets });
  } catch (err) {
    next(err);
  }
});

budgetsRouter.get('/history', async (req, res, next) => {
  try {
    const budgets = await budgetsService.list(req.user!.id);
    res.status(200).json({ budgets });
  } catch (err) {
    next(err);
  }
});

budgetsRouter.post('/', csrfProtection, async (req, res, next) => {
  try {
    const input = createBudgetSchema.parse(req.body);
    const budget = await budgetsService.create(req.user!.id, input);
    res.status(201).json({ budget });
  } catch (err) {
    next(err);
  }
});

budgetsRouter.patch('/:id', csrfProtection, async (req, res, next) => {
  try {
    const input = updateBudgetSchema.parse(req.body);
    const budget = await budgetsService.update(req.user!.id, String(req.params.id), input);
    res.status(200).json({ budget });
  } catch (err) {
    next(err);
  }
});

budgetsRouter.delete('/:id', csrfProtection, async (req, res, next) => {
  try {
    await budgetsService.remove(req.user!.id, String(req.params.id));
    res.status(200).json({ message: 'Budget deleted' });
  } catch (err) {
    next(err);
  }
});
