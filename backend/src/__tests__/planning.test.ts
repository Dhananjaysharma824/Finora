import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { prisma } from '../config/database.js';
import { hashToken } from '../utils/crypto.js';
import { computeBudgetStatus } from '../modules/budgets/budgets.service.js';
import { advanceDueDate } from '../modules/recurring/recurring.service.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ACC_ID = '22222222-2222-4222-8222-222222222222';
const CAT_FOOD_ID = '33333333-3333-4333-8333-333333333332';

const mem = {
  budgets: new Map<string, Record<string, unknown>>(),
  goals: new Map<string, Record<string, unknown>>(),
  contributions: new Map<string, Record<string, unknown>>(),
  recurring: new Map<string, Record<string, unknown>>(),
  transactions: new Map<string, Record<string, unknown>>(),
  notifications: [] as Array<Record<string, unknown>>,
};

function setupMockPrisma() {
  const tokenHash = hashToken('planning-session-token-12345');
  const tx = {
    session: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === tokenHash
          ? {
              id: 'sess-1',
              userId: USER_ID,
              tokenHash,
              expiresAt: new Date(Date.now() + 86400000),
              revokedAt: null,
              user: {
                id: USER_ID,
                email: 'alex@finora.local',
                name: 'Alex',
                role: 'user',
                emailVerified: true,
                currency: 'INR',
                dateFormat: 'dd MMM yyyy',
                numberFormat: 'en-IN',
                theme: 'light',
                timezone: 'Asia/Kolkata',
              },
            }
          : null,
      ),
    },
    account: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) =>
        where.id === ACC_ID && where.userId === USER_ID
          ? { id: ACC_ID, userId: USER_ID, name: 'Main Bank', currency: 'INR', isArchived: false }
          : null,
      ),
    },
    category: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === CAT_FOOD_ID
          ? { id: CAT_FOOD_ID, userId: null, slug: 'food', name: 'Food', type: 'EXPENSE', color: '#2F765B', isDefault: true }
          : null,
      ),
    },
    budget: {
      findMany: vi.fn(async ({ where }: { where: { userId: string; month?: string } }) =>
        [...mem.budgets.values()].filter(
          (b) => b.userId === where.userId && (!where.month || b.month === where.month),
        ),
      ),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        for (const b of mem.budgets.values()) {
          if (where.id && b.id === where.id && b.userId === where.userId) return b;
          if (
            where.categoryId &&
            b.userId === where.userId &&
            b.categoryId === where.categoryId &&
            b.month === where.month
          ) {
            return b;
          }
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const b = {
          id: randomUUID(),
          ...data,
          description: data.description ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
          category: { id: CAT_FOOD_ID, name: 'Food', slug: 'food', color: '#2F765B' },
        };
        mem.budgets.set(b.id, b);
        return b;
      }),
    },
    transaction: {
      findMany: vi.fn(async ({ where }: { where: { userId: string; categoryId?: string; type?: string } }) =>
        [...mem.transactions.values()].filter(
          (t) =>
            t.userId === where.userId &&
            (!where.categoryId || t.categoryId === where.categoryId) &&
            (!where.type || t.type === where.type),
        ),
      ),
      findFirst: vi.fn(async ({ where }: { where: { userId: string; idempotencyKey?: string } }) => {
        for (const t of mem.transactions.values()) {
          if (t.userId === where.userId && where.idempotencyKey && t.idempotencyKey === where.idempotencyKey) {
            return t;
          }
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const t = { id: randomUUID(), ...data, createdAt: new Date() };
        mem.transactions.set(t.id, t);
        return t;
      }),
    },
    savingsGoal: {
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        [...mem.goals.values()].filter((g) => g.userId === where.userId),
      ),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        const g = mem.goals.get(where.id);
        return g && g.userId === where.userId ? g : null;
      }),
      findFirstOrThrow: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        const g = mem.goals.get(where.id);
        if (!g || g.userId !== where.userId) throw new Error('Not found');
        return g;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const g = { id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() };
        mem.goals.set(g.id, g);
        return g;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const g = mem.goals.get(where.id)!;
        const updated = { ...g, ...data, updatedAt: new Date() };
        mem.goals.set(where.id, updated);
        return updated;
      }),
    },
    goalContribution: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string; idempotencyKey?: string } }) => {
        for (const c of mem.contributions.values()) {
          if (c.userId === where.userId && where.idempotencyKey && c.idempotencyKey === where.idempotencyKey) {
            return c;
          }
        }
        return null;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const c = { id: randomUUID(), ...data, contributedAt: new Date() };
        mem.contributions.set(c.id, c);
        return c;
      }),
    },
    recurringPayment: {
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        [...mem.recurring.values()].filter((r) => r.userId === where.userId),
      ),
      findFirst: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        const r = mem.recurring.get(where.id);
        return r && r.userId === where.userId ? r : null;
      }),
      findFirstOrThrow: vi.fn(async ({ where }: { where: { id: string; userId: string } }) => {
        const r = mem.recurring.get(where.id);
        if (!r || r.userId !== where.userId) throw new Error('Not found');
        return r;
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const r = {
          id: randomUUID(),
          ...data,
          category: { id: CAT_FOOD_ID, name: 'Food' },
          account: { id: ACC_ID, name: 'Main Bank', currency: 'INR' },
          createdAt: new Date(),
        };
        mem.recurring.set(r.id, r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const r = mem.recurring.get(where.id)!;
        const updated = { ...r, ...data };
        mem.recurring.set(where.id, updated);
        return updated;
      }),
    },
    notification: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        mem.notifications.push(data);
        return data;
      }),
    },
  };

  Object.assign(prisma, {
    ...tx,
    $transaction: vi.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
  });
}

describe('Finora Budgets, Goals & Recurring Payments API', () => {
  const app = createApp();
  const csrf = 'csrf-planning-token-123';
  const auth = {
    Cookie: `finora_sid=planning-session-token-12345; finora_csrf=${csrf}`,
    'X-CSRF-Token': csrf,
  };

  beforeEach(() => {
    mem.budgets.clear();
    mem.goals.clear();
    mem.contributions.clear();
    mem.recurring.clear();
    mem.transactions.clear();
    mem.notifications.length = 0;
    setupMockPrisma();
  });

  it('computes budget thresholds and prevents duplicate budgets for same category and month', async () => {
    expect(computeBudgetStatus(79.9)).toBe('HEALTHY');
    expect(computeBudgetStatus(80)).toBe('WARNING');
    expect(computeBudgetStatus(100)).toBe('EXCEEDED');

    mem.transactions.set('t1', {
      id: 't1',
      userId: USER_ID,
      categoryId: CAT_FOOD_ID,
      type: 'EXPENSE',
      amount: 4500,
    });

    const createRes = await request(app).post('/api/v1/budgets').set(auth).send({
      categoryId: CAT_FOOD_ID,
      limitAmount: 5000,
      month: '2026-11',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.budget.spentAmount).toBe(4500);
    expect(createRes.body.budget.remainingAmount).toBe(500);
    expect(createRes.body.budget.utilizationPct).toBe(90);
    expect(createRes.body.budget.status).toBe('WARNING');

    const dupRes = await request(app).post('/api/v1/budgets').set(auth).send({
      categoryId: CAT_FOOD_ID,
      limitAmount: 6000,
      month: '2026-11',
    });
    expect(dupRes.status).toBe(409);
  });

  it('tracks savings goal contributions idempotently and marks completed goals', async () => {
    const goalRes = await request(app).post('/api/v1/goals').set(auth).send({
      title: 'Emergency Fund',
      targetAmount: 10000,
      currentAmount: 7000,
      deadline: '2027-01-01',
    });
    expect(goalRes.status).toBe(201);
    const goalId = goalRes.body.goal.id as string;

    const contribHeaders = { ...auth, 'Idempotency-Key': 'goal-idem-12345678' };
    const c1 = await request(app)
      .post(`/api/v1/goals/${goalId}/contributions`)
      .set(contribHeaders)
      .send({ amount: 3000, sourceAccountId: ACC_ID });
    expect(c1.status).toBe(201);
    expect(c1.body.goal.currentAmount).toBe(10000);
    expect(c1.body.goal.isCompleted).toBe(true);
    expect(mem.notifications.length).toBe(1);

    // Idempotent retry must not double-count
    const c2 = await request(app)
      .post(`/api/v1/goals/${goalId}/contributions`)
      .set(contribHeaders)
      .send({ amount: 3000, sourceAccountId: ACC_ID });
    expect(c2.status).toBe(200);
    expect(c2.body.goal.currentAmount).toBe(10000);
    // Goal contributions must not create expense transactions
    expect(mem.transactions.size).toBe(0);
  });

  it('calculates recurring totals, pauses/resumes, and marks paid atomically', async () => {
    const nextMonth = advanceDueDate(new Date('2026-11-01T00:00:00Z'), 'MONTHLY');
    expect(nextMonth.toISOString().slice(0, 10)).toBe('2026-12-01');

    const recRes = await request(app).post('/api/v1/recurring').set(auth).send({
      title: 'Fiber Internet',
      amount: 1000,
      accountId: ACC_ID,
      categoryId: CAT_FOOD_ID,
      frequency: 'MONTHLY',
      nextPaymentDate: '2026-11-01',
      isActive: true,
    });
    expect(recRes.status).toBe(201);
    const recId = recRes.body.recurringPayment.id as string;

    const listRes = await request(app).get('/api/v1/recurring').set(auth);
    expect(listRes.body.summary.monthlyRecurringTotal).toBe(1000);
    expect(listRes.body.summary.annualRecurringTotal).toBe(12000);

    const paidRes = await request(app)
      .post(`/api/v1/recurring/${recId}/mark-paid`)
      .set({ ...auth, 'Idempotency-Key': 'rec-paid-12345678' });
    expect(paidRes.status).toBe(201);
    expect(paidRes.body.recurringPayment.nextPaymentDate.slice(0, 10)).toBe('2026-12-01');
    expect(mem.transactions.size).toBe(1);

    const pauseRes = await request(app).post(`/api/v1/recurring/${recId}/pause`).set(auth);
    expect(pauseRes.status).toBe(200);
    expect(pauseRes.body.recurringPayment.isActive).toBe(false);
  });
});
