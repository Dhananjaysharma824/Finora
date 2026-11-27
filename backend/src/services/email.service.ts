import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

export interface EmailDispatcher {
  sendVerificationEmail: (params: { to: string; name: string; token: string }) => Promise<void>;
  sendPasswordResetEmail: (params: { to: string; name: string; token: string }) => Promise<void>;
}

export const defaultEmailDispatcher: EmailDispatcher = {
  async sendVerificationEmail({ to }) {
    logger.info('verification_email_queued', {
      recipientDomain: to.split('@')[1] ?? 'unknown',
      environment: env.nodeEnv,
    });
  },
  async sendPasswordResetEmail({ to }) {
    logger.info('password_reset_email_queued', {
      recipientDomain: to.split('@')[1] ?? 'unknown',
      environment: env.nodeEnv,
    });
  },
};
