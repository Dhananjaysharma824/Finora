import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { healthRouter } from './modules/health/health.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { accountsRouter } from './modules/accounts/accounts.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { transactionsRouter } from './modules/transactions/transactions.routes.js';
import { budgetsRouter } from './modules/budgets/budgets.routes.js';
import { goalsRouter } from './modules/goals/goals.routes.js';
import { recurringRouter } from './modules/recurring/recurring.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import type { EmailDispatcher } from './services/email.service.js';
import { AppError } from './utils/AppError.js';

export function createApp(options?: { emailDispatcher?: EmailDispatcher }) {
  const app = express();

  app.disable('x-powered-by');
  if (env.nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow non-browser clients (curl/health checks) without Origin header
        if (!origin) {
          callback(null, true);
          return;
        }
        if (env.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new AppError('Origin not allowed by CORS policy', 403, 'CORS_FORBIDDEN'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'],
    }),
  );

  app.use(express.json({ limit: env.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: env.jsonBodyLimit }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.use('/api/v1/health', healthRouter);
  app.use('/health', healthRouter);
  app.use('/api/v1/auth', createAuthRouter(options?.emailDispatcher));
  app.use('/api/v1/accounts', accountsRouter);
  app.use('/api/v1/categories', categoriesRouter);
  app.use('/api/v1/transactions', transactionsRouter);
  app.use('/api/v1/budgets', budgetsRouter);
  app.use('/api/v1/goals', goalsRouter);
  app.use('/api/v1/recurring', recurringRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1', analyticsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
