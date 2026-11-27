import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateUser, csrfProtection } from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import {
  createTransactionSchema,
  importTransactionsSchema,
  listTransactionsQuerySchema,
  updateTransactionSchema,
} from './transactions.schemas.js';
import { transactionsService } from './transactions.service.js';

export const transactionsRouter = Router();

const bulkCsvRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.nodeEnv === 'test' ? 200 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many CSV import/export requests. Please try again later.',
    },
  },
});

transactionsRouter.use(authenticateUser);

transactionsRouter.get('/', async (req, res, next) => {
  try {
    const query = listTransactionsQuerySchema.parse(req.query);
    const result = await transactionsService.list(req.user!.id, query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.get('/export', bulkCsvRateLimiter, async (req, res, next) => {
  try {
    const query = listTransactionsQuerySchema.partial().parse(req.query);
    const csv = await transactionsService.exportCsv(req.user!.id, query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="finora-transactions.csv"');
    res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.post('/import', bulkCsvRateLimiter, csrfProtection, async (req, res, next) => {
  try {
    const { items } = importTransactionsSchema.parse(req.body);
    const result = await transactionsService.importBatch(req.user!.id, items);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

transactionsRouter.post('/', csrfProtection, async (req, res, next) => {
  try {
    const headerIdem = req.get('idempotency-key');
    const parsed = createTransactionSchema.parse({
      ...req.body,
      ...(headerIdem && !req.body?.idempotencyKey ? { idempotencyKey: headerIdem } : {}),
    });
    const tx = await transactionsService.create(req.user!.id, parsed);
    res.status(tx.deduplicated ? 200 : 201).json({ transaction: tx });
  } catch (err) {
    next(err);
  }
});

transactionsRouter.get('/:id', async (req, res, next) => {
  try {
    const tx = await transactionsService.getById(req.user!.id, String(req.params.id));
    res.status(200).json({ transaction: tx });
  } catch (err) {
    next(err);
  }
});

transactionsRouter.patch('/:id', csrfProtection, async (req, res, next) => {
  try {
    const input = updateTransactionSchema.parse(req.body);
    const tx = await transactionsService.update(req.user!.id, String(req.params.id), input);
    res.status(200).json({ transaction: tx });
  } catch (err) {
    next(err);
  }
});

transactionsRouter.delete('/:id', csrfProtection, async (req, res, next) => {
  try {
    await transactionsService.remove(req.user!.id, String(req.params.id));
    res.status(200).json({ message: 'Transaction deleted' });
  } catch (err) {
    next(err);
  }
});
