import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID().slice(0, 8);
  const startNs = process.hrtime.bigint();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    });
  });

  next();
}
