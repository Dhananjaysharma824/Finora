import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { prisma } from '../config/database.js';
import type { EmailDispatcher } from '../services/email.service.js';

interface MemUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  theme: string;
  timezone: string;
  createdAt: Date;
}

interface MemSession {
  id: string;
  userId: string;
  tokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

interface MemToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

const mem = {
  users: new Map<string, MemUser>(),
  sessions: new Map<string, MemSession>(),
  verifyTokens: new Map<string, MemToken>(),
  resetTokens: new Map<string, MemToken>(),
  auditLogs: [] as Array<Record<string, unknown>>,
};

function setupInMemoryPrisma() {
  const txClient = {
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return mem.users.get(where.id) ?? null;
        if (where.email) {
          for (const u of mem.users.values()) {
            if (u.email === where.email) return u;
          }
        }
        return null;
      }),
      create: vi.fn(
        async ({
          data,
          select,
        }: {
          data: Partial<MemUser>;
          select?: Record<string, boolean>;
        }) => {
          const user: MemUser = {
            id: randomUUID(),
            email: data.email!,
            name: data.name!,
            passwordHash: data.passwordHash!,
            role: data.role ?? 'user',
            emailVerified: data.emailVerified ?? false,
            emailVerifiedAt: null,
            currency: 'INR',
            dateFormat: 'dd MMM yyyy',
            numberFormat: 'en-IN',
            theme: 'light',
            timezone: 'Asia/Kolkata',
            createdAt: new Date(),
          };
          mem.users.set(user.id, user);
          if (select) {
            const picked: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(select)) {
              if (v) picked[k] = user[k as keyof MemUser];
            }
            return picked;
          }
          return user;
        },
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MemUser> }) => {
        const existing = mem.users.get(where.id);
        if (!existing) throw new Error('User not found');
        const updated = { ...existing, ...data };
        mem.users.set(where.id, updated);
        return updated;
      }),
    },
    session: {
      findUnique: vi.fn(
        async ({ where, include }: { where: { tokenHash: string }; include?: { user?: unknown } }) => {
          for (const s of mem.sessions.values()) {
            if (s.tokenHash === where.tokenHash) {
              if (include?.user) {
                const user = mem.users.get(s.userId);
                return { ...s, user };
              }
              return s;
            }
          }
          return null;
        },
      ),
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; userId: string; revokedAt: null } }) => {
          const s = mem.sessions.get(where.id);
          if (!s || s.userId !== where.userId || s.revokedAt !== null) return null;
          return s;
        },
      ),
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
        const now = new Date();
        return [...mem.sessions.values()].filter(
          (s) => s.userId === where.userId && s.revokedAt === null && s.expiresAt > now,
        );
      }),
      create: vi.fn(async ({ data }: { data: Partial<MemSession> }) => {
        const s: MemSession = {
          id: randomUUID(),
          userId: data.userId!,
          tokenHash: data.tokenHash!,
          userAgent: data.userAgent ?? null,
          ipAddress: data.ipAddress ?? null,
          expiresAt: data.expiresAt!,
          revokedAt: null,
          createdAt: new Date(),
        };
        mem.sessions.set(s.id, s);
        return s;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MemSession> }) => {
        const s = mem.sessions.get(where.id);
        if (!s) throw new Error('Session not found');
        const updated = { ...s, ...data };
        mem.sessions.set(where.id, updated);
        return updated;
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id?: string | { not: string }; userId?: string; revokedAt?: null };
          data: Partial<MemSession>;
        }) => {
          let count = 0;
          for (const [id, s] of mem.sessions.entries()) {
            const matchId =
              where.id === undefined
                ? true
                : typeof where.id === 'string'
                  ? s.id === where.id
                  : s.id !== where.id.not;
            const matchUser = where.userId === undefined || s.userId === where.userId;
            const matchRevoked = where.revokedAt === undefined || s.revokedAt === where.revokedAt;
            if (matchId && matchUser && matchRevoked) {
              mem.sessions.set(id, { ...s, ...data });
              count += 1;
            }
          }
          return { count };
        },
      ),
    },
    emailVerificationToken: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        for (const t of mem.verifyTokens.values()) {
          if (t.tokenHash === where.tokenHash) return t;
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Partial<MemToken> }) => {
        const t: MemToken = {
          id: randomUUID(),
          userId: data.userId!,
          tokenHash: data.tokenHash!,
          expiresAt: data.expiresAt!,
          usedAt: null,
          createdAt: new Date(),
        };
        mem.verifyTokens.set(t.id, t);
        return t;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MemToken> }) => {
        const t = mem.verifyTokens.get(where.id)!;
        const updated = { ...t, ...data };
        mem.verifyTokens.set(where.id, updated);
        return updated;
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; usedAt: null };
          data: Partial<MemToken>;
        }) => {
          const t = mem.verifyTokens.get(where.id);
          if (!t || t.usedAt !== null) return { count: 0 };
          mem.verifyTokens.set(where.id, { ...t, ...data });
          return { count: 1 };
        },
      ),
    },
    passwordResetToken: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        for (const t of mem.resetTokens.values()) {
          if (t.tokenHash === where.tokenHash) return t;
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Partial<MemToken> }) => {
        const t: MemToken = {
          id: randomUUID(),
          userId: data.userId!,
          tokenHash: data.tokenHash!,
          expiresAt: data.expiresAt!,
          usedAt: null,
          createdAt: new Date(),
        };
        mem.resetTokens.set(t.id, t);
        return t;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MemToken> }) => {
        const t = mem.resetTokens.get(where.id)!;
        const updated = { ...t, ...data };
        mem.resetTokens.set(where.id, updated);
        return updated;
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string; usedAt: null };
          data: Partial<MemToken>;
        }) => {
          const t = mem.resetTokens.get(where.id);
          if (!t || t.usedAt !== null) return { count: 0 };
          mem.resetTokens.set(where.id, { ...t, ...data });
          return { count: 1 };
        },
      ),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        mem.auditLogs.push(data);
        return data;
      }),
    },
  };

  Object.assign(prisma, {
    ...txClient,
    $transaction: vi.fn(async (cb: (tx: typeof txClient) => Promise<unknown>) => cb(txClient)),
  });
}

describe('Finora Custom Authentication', () => {
  let capturedVerifyToken = '';
  let capturedResetToken = '';

  const emailDispatcher: EmailDispatcher = {
    async sendVerificationEmail({ token }) {
      capturedVerifyToken = token;
    },
    async sendPasswordResetEmail({ token }) {
      capturedResetToken = token;
    },
  };

  const app = createApp({ emailDispatcher });

  beforeEach(() => {
    mem.users.clear();
    mem.sessions.clear();
    mem.verifyTokens.clear();
    mem.resetTokens.clear();
    mem.auditLogs.length = 0;
    capturedVerifyToken = '';
    capturedResetToken = '';
    setupInMemoryPrisma();
  });

  it('registers user, rejects duplicate email, and enforces strong password', async () => {
    const weakRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Alex',
      email: 'alex@finora.local',
      password: 'weak',
    });
    expect(weakRes.status).toBe(400);
    expect(weakRes.body.error.code).toBe('VALIDATION_ERROR');

    const okRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Alex Sharma',
      email: 'alex@finora.local',
      password: 'StrongPassword!1',
    });
    expect(okRes.status).toBe(201);
    expect(okRes.body.user.email).toBe('alex@finora.local');
    expect(okRes.body.user.passwordHash).toBeUndefined();
    expect(capturedVerifyToken.length).toBeGreaterThan(20);

    const dupRes = await request(app).post('/api/v1/auth/register').send({
      name: 'Alex Duplicate',
      email: 'alex@finora.local',
      password: 'StrongPassword!1',
    });
    expect(dupRes.status).toBe(409);
  });

  it('logs in with Argon2id, sets HttpOnly cookie, persists session, and rejects bad credentials', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Alex Sharma',
      email: 'alex@finora.local',
      password: 'StrongPassword!1',
    });

    const badRes = await request(app).post('/api/v1/auth/login').send({
      email: 'alex@finora.local',
      password: 'WrongPassword!1',
    });
    expect(badRes.status).toBe(401);
    expect(badRes.body.error.message).toBe('Invalid email or password');

    const agent = request.agent(app);
    const loginRes = await agent.post('/api/v1/auth/login').send({
      email: 'alex@finora.local',
      password: 'StrongPassword!1',
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.rawSessionToken).toBeUndefined();
    expect(loginRes.body.csrfToken).toBeDefined();
    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.includes('HttpOnly'))).toBe(true);

    const meRes = await agent.get('/api/v1/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('alex@finora.local');
  });

  it('enforces CSRF protection and revokes session on logout', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Alex Sharma',
      email: 'alex@finora.local',
      password: 'StrongPassword!1',
    });

    const agent = request.agent(app);
    const loginRes = await agent.post('/api/v1/auth/login').send({
      email: 'alex@finora.local',
      password: 'StrongPassword!1',
    });
    const csrfToken = loginRes.body.csrfToken as string;

    // Missing CSRF header must fail
    const noCsrf = await agent.post('/api/v1/auth/logout');
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.error.code).toBe('CSRF_INVALID');

    // Valid CSRF succeeds and revokes session
    const logoutOk = await agent
      .post('/api/v1/auth/logout')
      .set('X-CSRF-Token', csrfToken);
    expect(logoutOk.status).toBe(200);

    const meAfterLogout = await agent.get('/api/v1/auth/me');
    expect(meAfterLogout.status).toBe(401);
  });

  it('rejects expired and revoked sessions', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Alex Sharma',
      email: 'alex@finora.local',
      password: 'StrongPassword!1',
    });

    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({
      email: 'alex@finora.local',
      password: 'StrongPassword!1',
    });

    // Expire all sessions in memory
    for (const [id, s] of mem.sessions.entries()) {
      mem.sessions.set(id, { ...s, expiresAt: new Date(Date.now() - 1000) });
    }
    const expiredRes = await agent.get('/api/v1/auth/me');
    expect(expiredRes.status).toBe(401);
  });

  it('verifies email once and rejects token reuse', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Alex Sharma',
      email: 'alex@finora.local',
      password: 'StrongPassword!1',
    });

    const verifyOk = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: capturedVerifyToken });
    expect(verifyOk.status).toBe(200);

    const reuseRes = await request(app)
      .post('/api/v1/auth/verify-email')
      .send({ token: capturedVerifyToken });
    expect(reuseRes.status).toBe(400);
  });

  it('handles password reset generically and revokes active sessions on reset', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Alex Sharma',
      email: 'alex@finora.local',
      password: 'StrongPassword!1',
    });

    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({
      email: 'alex@finora.local',
      password: 'StrongPassword!1',
    });

    // Unknown email returns same 200 generic response
    const unknownForgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@finora.local' });
    expect(unknownForgot.status).toBe(200);

    const knownForgot = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'alex@finora.local' });
    expect(knownForgot.status).toBe(200);
    expect(capturedResetToken.length).toBeGreaterThan(20);

    const resetOk = await request(app).post('/api/v1/auth/reset-password').send({
      token: capturedResetToken,
      newPassword: 'NewStrongPassword!2',
    });
    expect(resetOk.status).toBe(200);

    // Active session must now be revoked
    const meAfterReset = await agent.get('/api/v1/auth/me');
    expect(meAfterReset.status).toBe(401);

    // Token reuse must fail
    const reuseReset = await request(app).post('/api/v1/auth/reset-password').send({
      token: capturedResetToken,
      newPassword: 'AnotherPassword!3',
    });
    expect(reuseReset.status).toBe(400);
  });
});
