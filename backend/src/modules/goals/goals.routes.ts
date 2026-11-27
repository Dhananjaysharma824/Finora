import { Router } from 'express';
import { authenticateUser, csrfProtection } from '../../middleware/auth.js';
import {
  contributeGoalSchema,
  createGoalSchema,
  updateGoalSchema,
} from './goals.schemas.js';
import { goalsService } from './goals.service.js';

export const goalsRouter = Router();

goalsRouter.use(authenticateUser);

goalsRouter.get('/', async (req, res, next) => {
  try {
    const goals = await goalsService.list(req.user!.id);
    res.status(200).json({ goals });
  } catch (err) {
    next(err);
  }
});

goalsRouter.post('/', csrfProtection, async (req, res, next) => {
  try {
    const input = createGoalSchema.parse(req.body);
    const goal = await goalsService.create(req.user!.id, input);
    res.status(201).json({ goal });
  } catch (err) {
    next(err);
  }
});

goalsRouter.patch('/:id', csrfProtection, async (req, res, next) => {
  try {
    const input = updateGoalSchema.parse(req.body);
    const goal = await goalsService.update(req.user!.id, String(req.params.id), input);
    res.status(200).json({ goal });
  } catch (err) {
    next(err);
  }
});

goalsRouter.delete('/:id', csrfProtection, async (req, res, next) => {
  try {
    await goalsService.remove(req.user!.id, String(req.params.id));
    res.status(200).json({ message: 'Savings goal deleted' });
  } catch (err) {
    next(err);
  }
});

goalsRouter.get('/:id/contributions', async (req, res, next) => {
  try {
    const contributions = await goalsService.listContributions(
      req.user!.id,
      String(req.params.id),
    );
    res.status(200).json({ contributions });
  } catch (err) {
    next(err);
  }
});

goalsRouter.post('/:id/contributions', csrfProtection, async (req, res, next) => {
  try {
    const headerIdem = req.get('idempotency-key');
    const input = contributeGoalSchema.parse({
      ...req.body,
      ...(headerIdem && !req.body?.idempotencyKey ? { idempotencyKey: headerIdem } : {}),
    });
    const result = await goalsService.contribute(req.user!.id, String(req.params.id), input);
    res.status(result.deduplicated ? 200 : 201).json(result);
  } catch (err) {
    next(err);
  }
});
