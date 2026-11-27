import { Router } from 'express';
import { authenticateUser, csrfProtection } from '../../middleware/auth.js';
import { createAccountSchema, updateAccountSchema } from './accounts.schemas.js';
import { accountsService } from './accounts.service.js';

export const accountsRouter = Router();

accountsRouter.use(authenticateUser);

accountsRouter.get('/', async (req, res, next) => {
  try {
    const accounts = await accountsService.list(req.user!.id);
    res.status(200).json({ accounts });
  } catch (err) {
    next(err);
  }
});

accountsRouter.post('/', csrfProtection, async (req, res, next) => {
  try {
    const input = createAccountSchema.parse(req.body);
    const account = await accountsService.create(req.user!.id, input);
    res.status(201).json({ account });
  } catch (err) {
    next(err);
  }
});

accountsRouter.get('/:id', async (req, res, next) => {
  try {
    const account = await accountsService.getById(req.user!.id, String(req.params.id));
    res.status(200).json({ account });
  } catch (err) {
    next(err);
  }
});

accountsRouter.patch('/:id', csrfProtection, async (req, res, next) => {
  try {
    const input = updateAccountSchema.parse(req.body);
    const account = await accountsService.update(req.user!.id, String(req.params.id), input);
    res.status(200).json({ account });
  } catch (err) {
    next(err);
  }
});

accountsRouter.delete('/:id', csrfProtection, async (req, res, next) => {
  try {
    await accountsService.archive(req.user!.id, String(req.params.id));
    res.status(200).json({ message: 'Account archived' });
  } catch (err) {
    next(err);
  }
});

accountsRouter.get('/:id/transactions', async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1) || 1;
    const pageSize = Number(req.query.pageSize ?? 20) || 20;
    const result = await accountsService.getTransactions(
      req.user!.id,
      String(req.params.id),
      page,
      pageSize,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
