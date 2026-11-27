import { Router } from 'express';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'finora-server',
    environment: env.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/ready', async (_req, res) => {
  if (!env.databaseUrl) {
    res.status(503).json({ status: 'not_ready', reason: 'DATABASE_URL not configured' });
    return;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'not_ready', database: 'unreachable' });
  }
});
