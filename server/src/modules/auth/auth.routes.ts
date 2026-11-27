import { Router } from 'express';
import {
  authenticateUser,
  authenticationRateLimiter,
  clearSessionCookie,
  csrfProtection,
  issueCsrfCookie,
  setSessionCookie,
} from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import { hashToken } from '../../utils/crypto.js';
import { prisma } from '../../config/database.js';
import type { EmailDispatcher } from '../../services/email.service.js';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.schemas.js';
import { createAuthService } from './auth.service.js';

export function createAuthRouter(emailDispatcher?: EmailDispatcher) {
  const router = Router();
  const authService = createAuthService(emailDispatcher);

  router.get('/csrf-token', (_req, res) => {
    const csrfToken = issueCsrfCookie(res);
    res.status(200).json({ csrfToken });
  });

  router.post('/register', authenticationRateLimiter, async (req, res, next) => {
    try {
      const input = registerSchema.parse(req.body);
      const user = await authService.register({
        ...input,
        ipAddress: req.ip,
      });
      res.status(201).json({
        user,
        message: 'Registration successful. Please verify your email address.',
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', authenticationRateLimiter, async (req, res, next) => {
    try {
      const input = loginSchema.parse(req.body);

      let previousSessionId: string | undefined;
      const existingRaw = req.cookies?.[env.cookieName] as string | undefined;
      if (existingRaw) {
        const existingSession = await prisma.session.findUnique({
          where: { tokenHash: hashToken(existingRaw) },
          select: { id: true },
        });
        previousSessionId = existingSession?.id;
      }

      const result = await authService.login({
        ...input,
        userAgent: req.get('user-agent'),
        ipAddress: req.ip,
        previousSessionId,
      });

      setSessionCookie(res, result.rawSessionToken);
      const csrfToken = issueCsrfCookie(res);

      res.status(200).json({
        user: result.user,
        csrfToken,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout', authenticateUser, csrfProtection, async (req, res, next) => {
    try {
      await authService.logout(req.sessionId!, req.user!.id, req.ip);
      clearSessionCookie(res);
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', authenticateUser, (req, res) => {
    res.status(200).json({ user: req.user });
  });

  router.post('/verify-email', authenticationRateLimiter, async (req, res, next) => {
    try {
      const { token } = verifyEmailSchema.parse(req.body);
      await authService.verifyEmail(token, req.ip);
      res.status(200).json({ message: 'Email verified successfully' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/forgot-password', authenticationRateLimiter, async (req, res, next) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      await authService.forgotPassword(email, req.ip);
      res.status(200).json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
    } catch (err) {
      next(err);
    }
  });

  router.post('/reset-password', authenticationRateLimiter, async (req, res, next) => {
    try {
      const { token, newPassword } = resetPasswordSchema.parse(req.body);
      await authService.resetPassword(token, newPassword, req.ip);
      clearSessionCookie(res);
      res.status(200).json({ message: 'Password reset successful. Please log in again.' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/change-password', authenticateUser, csrfProtection, async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      await authService.changePassword({
        userId: req.user!.id,
        currentSessionId: req.sessionId!,
        currentPassword,
        newPassword,
        ipAddress: req.ip,
      });
      res.status(200).json({ message: 'Password updated successfully' });
    } catch (err) {
      next(err);
    }
  });

  router.get('/sessions', authenticateUser, async (req, res, next) => {
    try {
      const sessions = await authService.listActiveSessions(req.user!.id, req.sessionId);
      res.status(200).json({ sessions });
    } catch (err) {
      next(err);
    }
  });

  router.delete(
    '/sessions/:sessionId',
    authenticateUser,
    csrfProtection,
    async (req, res, next) => {
      try {
        await authService.revokeSession(req.user!.id, String(req.params.sessionId), req.ip);
        if (req.params.sessionId === req.sessionId) {
          clearSessionCookie(res);
        }
        res.status(200).json({ message: 'Session revoked' });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/sessions/revoke-all',
    authenticateUser,
    csrfProtection,
    async (req, res, next) => {
      try {
        await authService.revokeAllSessions(req.user!.id, req.ip);
        clearSessionCookie(res);
        res.status(200).json({ message: 'All sessions revoked' });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
