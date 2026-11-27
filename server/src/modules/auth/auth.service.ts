import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import {
  generateOpaqueToken,
  hashPassword,
  hashToken,
  verifyPassword,
} from '../../utils/crypto.js';
import { SESSION_TTL_MS } from '../../middleware/auth.js';
import {
  defaultEmailDispatcher,
  type EmailDispatcher,
} from '../../services/email.service.js';

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

// Precomputed dummy Argon2id-format timing guard so non-existent email logins take comparable time
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export function createAuthService(emailDispatcher: EmailDispatcher = defaultEmailDispatcher) {
  return {
    async register(input: { name: string; email: string; password: string; ipAddress?: string }) {
      const existing = await prisma.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new AppError('An account with this email already exists', 409, 'EMAIL_EXISTS');
      }

      const passwordHash = await hashPassword(input.password);
      const rawVerifyToken = generateOpaqueToken(32);
      const verifyTokenHash = hashToken(rawVerifyToken);

      const user = await prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: input.email,
            name: input.name,
            passwordHash,
            role: 'user',
            emailVerified: false,
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            emailVerified: true,
            currency: true,
            dateFormat: true,
            numberFormat: true,
            theme: true,
            timezone: true,
            createdAt: true,
          },
        });

        await tx.emailVerificationToken.create({
          data: {
            userId: created.id,
            tokenHash: verifyTokenHash,
            expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
          },
        });

        await tx.auditLog.create({
          data: {
            userId: created.id,
            action: 'AUTH_REGISTER',
            entityType: 'User',
            entityId: created.id,
            ipAddress: input.ipAddress,
          },
        });

        return created;
      });

      await emailDispatcher.sendVerificationEmail({
        to: user.email,
        name: user.name,
        token: rawVerifyToken,
      });

      return user;
    },

    async login(input: {
      email: string;
      password: string;
      userAgent?: string;
      ipAddress?: string;
      previousSessionId?: string;
    }) {
      const user = await prisma.user.findUnique({
        where: { email: input.email },
      });

      const validPassword = user
        ? await verifyPassword(user.passwordHash, input.password)
        : await verifyPassword(DUMMY_PASSWORD_HASH, input.password);

      if (!user || !validPassword) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      const rawSessionToken = generateOpaqueToken(32);
      const sessionTokenHash = hashToken(rawSessionToken);
      const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

      const session = await prisma.$transaction(async (tx) => {
        // Rotate previous session if user is logging in again with an active session
        if (input.previousSessionId) {
          await tx.session.updateMany({
            where: { id: input.previousSessionId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        const created = await tx.session.create({
          data: {
            userId: user.id,
            tokenHash: sessionTokenHash,
            userAgent: input.userAgent?.slice(0, 250),
            ipAddress: input.ipAddress,
            expiresAt,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'AUTH_LOGIN',
            entityType: 'Session',
            entityId: created.id,
            ipAddress: input.ipAddress,
          },
        });

        return created;
      });

      return {
        rawSessionToken,
        sessionId: session.id,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
          currency: user.currency,
          dateFormat: user.dateFormat,
          numberFormat: user.numberFormat,
          theme: user.theme,
          timezone: user.timezone,
        },
      };
    },

    async logout(sessionId: string, userId: string, ipAddress?: string) {
      await prisma.$transaction(async (tx) => {
        await tx.session.updateMany({
          where: { id: sessionId, userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: 'AUTH_LOGOUT',
            entityType: 'Session',
            entityId: sessionId,
            ipAddress,
          },
        });
      });
    },

    async verifyEmail(rawToken: string, ipAddress?: string) {
      const tokenHash = hashToken(rawToken);
      const record = await prisma.emailVerificationToken.findUnique({
        where: { tokenHash },
      });

      if (!record || record.usedAt !== null || record.expiresAt <= new Date()) {
        throw new AppError('Verification token is invalid or expired', 400, 'INVALID_TOKEN');
      }

      const now = new Date();
      await prisma.$transaction(async (tx) => {
        const consumed = await tx.emailVerificationToken.updateMany({
          where: { id: record.id, usedAt: null },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) {
          throw new AppError('Verification token is invalid or expired', 400, 'INVALID_TOKEN');
        }
        await tx.user.update({
          where: { id: record.userId },
          data: { emailVerified: true, emailVerifiedAt: now },
        });
        await tx.auditLog.create({
          data: {
            userId: record.userId,
            action: 'AUTH_EMAIL_VERIFIED',
            entityType: 'User',
            entityId: record.userId,
            ipAddress,
          },
        });
      });
    },

    async forgotPassword(email: string, ipAddress?: string) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return; // Generic success response to prevent account enumeration
      }

      const rawResetToken = generateOpaqueToken(32);
      const resetTokenHash = hashToken(rawResetToken);

      await prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: resetTokenHash,
            expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'AUTH_PASSWORD_RESET_REQUESTED',
            entityType: 'User',
            entityId: user.id,
            ipAddress,
          },
        });
      });

      await emailDispatcher.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        token: rawResetToken,
      });
    },

    async resetPassword(rawToken: string, newPassword: string, ipAddress?: string) {
      const tokenHash = hashToken(rawToken);
      const record = await prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      if (!record || record.usedAt !== null || record.expiresAt <= new Date()) {
        throw new AppError('Password reset token is invalid or expired', 400, 'INVALID_TOKEN');
      }

      const newPasswordHash = await hashPassword(newPassword);
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        const consumed = await tx.passwordResetToken.updateMany({
          where: { id: record.id, usedAt: null },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) {
          throw new AppError('Password reset token is invalid or expired', 400, 'INVALID_TOKEN');
        }
        await tx.user.update({
          where: { id: record.userId },
          data: { passwordHash: newPasswordHash },
        });
        // Revoke all active sessions after password reset
        await tx.session.updateMany({
          where: { userId: record.userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.auditLog.create({
          data: {
            userId: record.userId,
            action: 'AUTH_PASSWORD_RESET_COMPLETED',
            entityType: 'User',
            entityId: record.userId,
            ipAddress,
          },
        });
      });
    },

    async changePassword(params: {
      userId: string;
      currentSessionId: string;
      currentPassword: string;
      newPassword: string;
      ipAddress?: string;
    }) {
      const user = await prisma.user.findUnique({ where: { id: params.userId } });
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      const valid = await verifyPassword(user.passwordHash, params.currentPassword);
      if (!valid) {
        throw new AppError('Current password is incorrect', 401, 'INVALID_CREDENTIALS');
      }

      const newPasswordHash = await hashPassword(params.newPassword);
      const now = new Date();

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { passwordHash: newPasswordHash },
        });
        // Revoke all other active sessions
        await tx.session.updateMany({
          where: {
            userId: user.id,
            id: { not: params.currentSessionId },
            revokedAt: null,
          },
          data: { revokedAt: now },
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'AUTH_PASSWORD_CHANGED',
            entityType: 'User',
            entityId: user.id,
            ipAddress: params.ipAddress,
          },
        });
      });
    },

    async listActiveSessions(userId: string, currentSessionId?: string) {
      const sessions = await prisma.session.findMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          expiresAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return sessions.map((s) => ({
        ...s,
        isCurrent: s.id === currentSessionId,
      }));
    },

    async revokeSession(userId: string, targetSessionId: string, ipAddress?: string) {
      const existing = await prisma.session.findFirst({
        where: { id: targetSessionId, userId, revokedAt: null },
      });
      if (!existing) {
        throw new AppError('Session not found', 404, 'SESSION_NOT_FOUND');
      }

      await prisma.$transaction(async (tx) => {
        await tx.session.update({
          where: { id: existing.id },
          data: { revokedAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: 'AUTH_SESSION_REVOKED',
            entityType: 'Session',
            entityId: existing.id,
            ipAddress,
          },
        });
      });
    },

    async revokeAllSessions(userId: string, ipAddress?: string) {
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        await tx.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.auditLog.create({
          data: {
            userId,
            action: 'AUTH_ALL_SESSIONS_REVOKED',
            entityType: 'User',
            entityId: userId,
            ipAddress,
          },
        });
      });
    },
  };
}
