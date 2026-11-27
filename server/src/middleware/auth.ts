import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { generateOpaqueToken, hashToken, timingSafeEqualStrings } from '../utils/crypto.js';

export const CSRF_COOKIE_NAME = 'finora_csrf';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function setSessionCookie(res: Response, rawToken: string): void {
  res.cookie(env.cookieName, rawToken, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export function issueCsrfCookie(res: Response): string {
  const token = generateOpaqueToken(24);
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false, // Readable by frontend JS to send via X-CSRF-Token header (double-submit pattern)
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
  return token;
}

export async function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawToken = req.cookies?.[env.cookieName] as string | undefined;
    if (!rawToken || typeof rawToken !== 'string') {
      return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
    }

    const tokenHash = hashToken(rawToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: {
        user: {
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
          },
        },
      },
    });

    if (!session || session.revokedAt !== null || session.expiresAt <= new Date()) {
      return next(new AppError('Session is invalid or expired', 401, 'SESSION_INVALID'));
    }

    req.user = session.user;
    req.sessionId = session.id;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireVerifiedEmail(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    return next(new AppError('Authentication required', 401, 'UNAUTHENTICATED'));
  }
  if (!req.user.emailVerified) {
    return next(new AppError('Email verification required', 403, 'EMAIL_NOT_VERIFIED'));
  }
  next();
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  // Validate Origin header when present
  const origin = req.headers.origin;
  if (origin && !env.corsOrigins.includes(origin)) {
    return next(new AppError('Invalid request origin', 403, 'CSRF_ORIGIN_MISMATCH'));
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined;
  const headerToken = req.headers['x-csrf-token'];
  const headerStr = Array.isArray(headerToken) ? headerToken[0] : headerToken;

  if (!cookieToken || !headerStr || !timingSafeEqualStrings(cookieToken, headerStr)) {
    return next(new AppError('Invalid or missing CSRF token', 403, 'CSRF_INVALID'));
  }

  next();
}

export const authenticationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: env.nodeEnv === 'test' ? 100 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Please try again later.',
    },
  },
});
