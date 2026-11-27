import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { prisma } from '../config/database.js';
import { hashToken } from '../utils/crypto.js';

interface MemUser {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  theme: string;
  timezone: string;
}

interface MemAccount {
  id: string;
  userId: string;
  name: string;
  type: 'BANK' | 'SAVINGS' | 'CASH' | 'WALLET';
  currency: string;
  openingBalance: number;
  institution?: string | null;
  lastFour?: string | null;
  color: string;
  isArchived: boolean;
  createdAt: Date;
}

interface MemCategory {
  id: string;
  userId: string | null;
  slug: string;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  color: string;
  isDefault: boolean;
}

interface MemTx {
  id: string;
  userId: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string;
  title: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  currency: string;
  date: Date;
  notes?: string | null;
  idempotencyKey?: string | null;
  createdAt: Date;
}

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const CAT_SALARY = '33333333-3333-4333-8333-333333333331';
const CAT_FOOD = '33333333-3333-4333-8333-333333333332';
const CAT_TRANSFER = '33333333-3333-4333-8333-333333333333';

const store = {
  users: new Map<string, MemUser>(),
  sessions: new Map<string, { id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null }>(),
  accounts: new Map<string, MemAccount>(),
  categories: new Map<string, MemCategory>(),
  transactions: new Map<string, MemTx>(),
};

function setupMockDb() {
  const tx = {
    session: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        for (const s of store.sessions.values()) {
          if (s.tokenHash === where.tokenHash) {
            return { ...s, user: store.users.get(s.userId) };
          }
        }
        return null;
      }),
    },
    account: {
      findMany: vi.fn(async ({ where }: { where: { userId: string; isArchived: boolean } }) =>
        [...store.accounts.values()].filter(
          (a) => a.userId === where.userId && a.isArchived === where.isArchived,
        ),
      ),
      findFirst: vi.fn(
        async ({ where }: { where: { id: string; userId: string; isArchived?: boolean } }) => {
          const a = store.accounts.get(where.id);
          if (!a || a.userId !== where.userId) return null;
          if (where.isArchived !== undefined && a.isArchived !== where.isArchived) return null;
          return a;
        },
      ),
      count: vi.fn(async ({ where }: { where: { userId: string; isArchived: boolean } }) =>
        [...store.accounts.values()].filter(
          (a) => a.userId === where.userId && a.isArchived === where.isArchived,
        ).length,
      ),
      create: vi.fn(async ({ data }: { data: Partial<MemAccount> }) => {
        const a: MemAccount = {
          id: randomUUID(),
          userId: data.userId!,
          name: data.name!,
          type: data.type!,
          currency: data.currency ?? 'INR',
          openingBalance: Number(data.openingBalance ?? 0),
          institution: data.institution ?? null,
          lastFour: data.lastFour ?? null,
          color: data.color ?? '#153D32',
          isArchived: false,
          createdAt: new Date(),
        };
        store.accounts.set(a.id, a);
        return a;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MemAccount> }) => {
        const a = store.accounts.get(where.id)!;
        const updated = { ...a, ...data };
        store.accounts.set(where.id, updated);
        return updated;
      }),
    },
    category: {
      findMany: vi.fn(async ({ where }: { where: { OR: Array<{ userId: string | null; isDefault?: boolean }> } }) =>
        [...store.categories.values()].filter(
          (c) => c.isDefault || where.OR.some((cond) => cond.userId === c.userId),
        ),
      ),
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        for (const c of store.categories.values()) {
          if (typeof where.id === 'string' && c.id === where.id) {
            if (Array.isArray(where.OR)) {
              const ok = where.OR.some(
                (cond: { userId?: string | null; isDefault?: boolean }) =>
                  (cond.userId !== undefined && c.userId === cond.userId) ||
                  (cond.isDefault && c.isDefault),
              );
              if (ok) return c;
            }
          }
          if (typeof where.slug === 'string' && c.slug === where.slug && c.userId === where.userId) {
            return c;
          }
        }
        return null;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => store.categories.get(where.id) ?? null),
      create: vi.fn(async ({ data }: { data: Partial<MemCategory> }) => {
        const c: MemCategory = {
          id: randomUUID(),
          userId: data.userId ?? null,
          slug: data.slug!,
          name: data.name!,
          type: data.type!,
          color: data.color ?? '#2F765B',
          isDefault: Boolean(data.isDefault),
        };
        store.categories.set(c.id, c);
        return c;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<MemCategory> }) => {
        const c = store.categories.get(where.id)!;
        const updated = { ...c, ...data };
        store.categories.set(where.id, updated);
        return updated;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        store.categories.delete(where.id);
      }),
    },
    transaction: {
      findFirst: vi.fn(async ({ where }: { where: { id?: string; userId?: string; idempotencyKey?: string } }) => {
        for (const t of store.transactions.values()) {
          if (where.id && t.id === where.id && (!where.userId || t.userId === where.userId)) {
            return {
              ...t,
              category: store.categories.get(t.categoryId),
              account: store.accounts.get(t.accountId),
              toAccount: t.toAccountId ? store.accounts.get(t.toAccountId) : null,
            };
          }
          if (where.idempotencyKey && t.userId === where.userId && t.idempotencyKey === where.idempotencyKey) {
            return {
              ...t,
              category: store.categories.get(t.categoryId),
              account: store.accounts.get(t.accountId),
              toAccount: t.toAccountId ? store.accounts.get(t.toAccountId) : null,
            };
          }
        }
        return null;
      }),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId?: string; OR?: Array<{ accountId?: string; toAccountId?: string }>; type?: string };
        }) => {
          return [...store.transactions.values()]
            .filter((t) => {
              if (where.userId && t.userId !== where.userId) return false;
              if (where.type && t.type !== where.type) return false;
              if (where.OR) {
                const matchAcc = where.OR.some(
                  (o) =>
                    (o.accountId && t.accountId === o.accountId) ||
                    (o.toAccountId && t.toAccountId === o.toAccountId),
                );
                if (!matchAcc) return false;
              }
              return true;
            })
            .map((t) => ({
              ...t,
              category: store.categories.get(t.categoryId)!,
              account: store.accounts.get(t.accountId)!,
              toAccount: t.toAccountId ? store.accounts.get(t.toAccountId)! : null,
            }));
        },
      ),
      count: vi.fn(async ({ where }: { where: { userId?: string; categoryId?: string } }) =>
        [...store.transactions.values()].filter(
          (t) =>
            (!where.userId || t.userId === where.userId) &&
            (!where.categoryId || t.categoryId === where.categoryId),
        ).length,
      ),
      create: vi.fn(async ({ data }: { data: Partial<MemTx> }) => {
        const t: MemTx = {
          id: randomUUID(),
          userId: data.userId!,
          accountId: data.accountId!,
          toAccountId: data.toAccountId ?? null,
          categoryId: data.categoryId!,
          title: data.title!,
          amount: Number(data.amount),
          type: data.type!,
          currency: data.currency ?? 'INR',
          date: data.date!,
          notes: data.notes ?? null,
          idempotencyKey: data.idempotencyKey ?? null,
          createdAt: new Date(),
        };
        store.transactions.set(t.id, t);
        return {
          ...t,
          category: store.categories.get(t.categoryId),
          account: store.accounts.get(t.accountId),
          toAccount: t.toAccountId ? store.accounts.get(t.toAccountId) : null,
        };
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        store.transactions.delete(where.id);
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: unknown }) => data),
    },
  };

  Object.assign(prisma, {
    ...tx,
    $transaction: vi.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
  });
}

describe('Finora Accounts, Categories & Transactions API', () => {
  const app = createApp();
  const tokenA = 'session-token-user-a-1234567890';
  const tokenB = 'session-token-user-b-1234567890';
  const csrfToken = 'csrf-token-test-1234567890';

  beforeEach(() => {
    store.users.clear();
    store.sessions.clear();
    store.accounts.clear();
    store.categories.clear();
    store.transactions.clear();

    store.users.set(USER_A, {
      id: USER_A,
      email: 'a@finora.local',
      name: 'User A',
      role: 'user',
      emailVerified: true,
      currency: 'INR',
      dateFormat: 'dd MMM yyyy',
      numberFormat: 'en-IN',
      theme: 'light',
      timezone: 'Asia/Kolkata',
    });
    store.users.set(USER_B, {
      id: USER_B,
      email: 'b@finora.local',
      name: 'User B',
      role: 'user',
      emailVerified: true,
      currency: 'INR',
      dateFormat: 'dd MMM yyyy',
      numberFormat: 'en-IN',
      theme: 'light',
      timezone: 'Asia/Kolkata',
    });

    store.sessions.set('sA', {
      id: 'sA',
      userId: USER_A,
      tokenHash: hashToken(tokenA),
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });
    store.sessions.set('sB', {
      id: 'sB',
      userId: USER_B,
      tokenHash: hashToken(tokenB),
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });

    store.categories.set(CAT_SALARY, {
      id: CAT_SALARY,
      userId: null,
      slug: 'salary',
      name: 'Salary',
      type: 'INCOME',
      color: '#153D32',
      isDefault: true,
    });
    store.categories.set(CAT_FOOD, {
      id: CAT_FOOD,
      userId: null,
      slug: 'food',
      name: 'Food',
      type: 'EXPENSE',
      color: '#2F765B',
      isDefault: true,
    });
    store.categories.set(CAT_TRANSFER, {
      id: CAT_TRANSFER,
      userId: null,
      slug: 'transfer',
      name: 'Transfer',
      type: 'TRANSFER',
      color: '#66736A',
      isDefault: true,
    });

    setupMockDb();
  });

  const authHeadersA = {
    Cookie: `finora_sid=${tokenA}; finora_csrf=${csrfToken}`,
    'X-CSRF-Token': csrfToken,
  };
  const authHeadersB = {
    Cookie: `finora_sid=${tokenB}; finora_csrf=${csrfToken}`,
    'X-CSRF-Token': csrfToken,
  };

  it('calculates account balances accurately across income, expense, and transfers', async () => {
    const accMainRes = await request(app)
      .post('/api/v1/accounts')
      .set(authHeadersA)
      .send({ name: 'Main Bank', type: 'BANK', currency: 'INR', openingBalance: 10000 });
    expect(accMainRes.status).toBe(201);
    const accMainId = accMainRes.body.account.id as string;

    const accSavRes = await request(app)
      .post('/api/v1/accounts')
      .set(authHeadersA)
      .send({ name: 'Savings', type: 'SAVINGS', currency: 'INR', openingBalance: 5000 });
    expect(accSavRes.status).toBe(201);
    const accSavId = accSavRes.body.account.id as string;

    // Income +45,000
    await request(app)
      .post('/api/v1/transactions')
      .set(authHeadersA)
      .send({
        title: 'Salary',
        amount: 45000,
        type: 'INCOME',
        currency: 'INR',
        accountId: accMainId,
        categoryId: CAT_SALARY,
        date: '2026-11-01',
      });

    // Expense -2,500
    await request(app)
      .post('/api/v1/transactions')
      .set(authHeadersA)
      .send({
        title: 'Groceries',
        amount: 2500,
        type: 'EXPENSE',
        currency: 'INR',
        accountId: accMainId,
        categoryId: CAT_FOOD,
        date: '2026-11-05',
      });

    // Transfer 10,000 Main -> Savings
    const transferRes = await request(app)
      .post('/api/v1/transactions')
      .set(authHeadersA)
      .send({
        title: 'Save',
        amount: 10000,
        type: 'TRANSFER',
        currency: 'INR',
        accountId: accMainId,
        toAccountId: accSavId,
        categoryId: CAT_TRANSFER,
        date: '2026-11-10',
      });
    expect(transferRes.status).toBe(201);

    const listRes = await request(app).get('/api/v1/accounts').set(authHeadersA);
    const main = listRes.body.accounts.find((a: { id: string }) => a.id === accMainId);
    const sav = listRes.body.accounts.find((a: { id: string }) => a.id === accSavId);
    expect(main.balance).toBe(42500);
    expect(sav.balance).toBe(15000);
  });

  it('prevents cross-user access, cross-currency transfers, negative amounts, and duplicate idempotency keys', async () => {
    const accA = await request(app)
      .post('/api/v1/accounts')
      .set(authHeadersA)
      .send({ name: 'User A INR', type: 'BANK', currency: 'INR', openingBalance: 1000 });
    const accAId = accA.body.account.id as string;

    const accAUsd = await request(app)
      .post('/api/v1/accounts')
      .set(authHeadersA)
      .send({ name: 'User A USD', type: 'BANK', currency: 'USD', openingBalance: 100 });
    const accAUsdId = accAUsd.body.account.id as string;

    // Cross-user IDOR attempt by User B on User A's account
    const idorRes = await request(app)
      .post('/api/v1/transactions')
      .set(authHeadersB)
      .send({
        title: 'Steal',
        amount: 500,
        type: 'EXPENSE',
        currency: 'INR',
        accountId: accAId,
        categoryId: CAT_FOOD,
        date: '2026-11-10',
      });
    expect(idorRes.status).toBe(404);

    // Cross-currency transfer rejected
    const crossCurrency = await request(app)
      .post('/api/v1/transactions')
      .set(authHeadersA)
      .send({
        title: 'FX Transfer',
        amount: 100,
        type: 'TRANSFER',
        currency: 'INR',
        accountId: accAId,
        toAccountId: accAUsdId,
        categoryId: CAT_TRANSFER,
        date: '2026-11-10',
      });
    expect(crossCurrency.status).toBe(400);
    expect(crossCurrency.body.error.code).toBe('CROSS_CURRENCY_NOT_SUPPORTED');

    // Negative amount rejected
    const negRes = await request(app)
      .post('/api/v1/transactions')
      .set(authHeadersA)
      .send({
        title: 'Negative',
        amount: -100,
        type: 'EXPENSE',
        currency: 'INR',
        accountId: accAId,
        categoryId: CAT_FOOD,
        date: '2026-11-10',
      });
    expect(negRes.status).toBe(400);

    // Idempotency key prevents duplicate transaction
    const idemHeaders = { ...authHeadersA, 'Idempotency-Key': 'idem-key-12345678' };
    const first = await request(app).post('/api/v1/transactions').set(idemHeaders).send({
      title: '=CMD("calc")',
      amount: 250,
      type: 'EXPENSE',
      currency: 'INR',
      accountId: accAId,
      categoryId: CAT_FOOD,
      date: '2026-11-10',
    });
    expect(first.status).toBe(201);

    const second = await request(app).post('/api/v1/transactions').set(idemHeaders).send({
      title: '=CMD("calc")',
      amount: 250,
      type: 'EXPENSE',
      currency: 'INR',
      accountId: accAId,
      categoryId: CAT_FOOD,
      date: '2026-11-10',
    });
    expect(second.status).toBe(200);
    expect(second.body.transaction.id).toBe(first.body.transaction.id);

    // CSV Export neutralizes formula injection
    const csvRes = await request(app).get('/api/v1/transactions/export').set(authHeadersA);
    expect(csvRes.status).toBe(200);
    expect(csvRes.text).toContain('"\'=CMD(""calc"")"');
  });

  it('protects shared default categories from modification', async () => {
    const patchDefault = await request(app)
      .patch(`/api/v1/categories/${CAT_FOOD}`)
      .set(authHeadersA)
      .send({ name: 'Hacked' });
    expect(patchDefault.status).toBe(403);
  });
});
