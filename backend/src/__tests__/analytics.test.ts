import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { prisma } from '../config/database.js';
import { hashToken } from '../utils/crypto.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '99999999-9999-4999-8999-999999999999';

function setupAnalyticsMock() {
  const tokenHash = hashToken('analytics-token-123456');
  const txs = [
    {
      id: 't1',
      userId: USER_ID,
      accountId: 'a1',
      categoryId: 'c_sal',
      title: 'Salary',
      amount: 50000,
      type: 'INCOME',
      date: new Date('2026-11-01T00:00:00Z'),
      category: { id: 'c_sal', name: 'Salary', color: '#153D32' },
      account: { id: 'a1', name: 'Main Bank' },
    },
    {
      id: 't2',
      userId: USER_ID,
      accountId: 'a1',
      categoryId: 'c_food',
      title: 'Groceries',
      amount: 10000,
      type: 'EXPENSE',
      date: new Date('2026-11-05T00:00:00Z'),
      category: { id: 'c_food', name: 'Food', color: '#2F765B' },
      account: { id: 'a1', name: 'Main Bank' },
    },
    {
      id: 't3',
      userId: USER_ID,
      accountId: 'a1',
      categoryId: 'c_tr',
      title: 'Transfer',
      amount: 15000,
      type: 'TRANSFER',
      date: new Date('2026-11-08T00:00:00Z'),
      category: { id: 'c_tr', name: 'Transfer', color: '#66736A' },
      account: { id: 'a1', name: 'Main Bank' },
    },
    // Previous month transaction
    {
      id: 't4',
      userId: USER_ID,
      accountId: 'a1',
      categoryId: 'c_sal',
      title: 'Prev Salary',
      amount: 40000,
      type: 'INCOME',
      date: new Date('2026-10-01T00:00:00Z'),
      category: { id: 'c_sal', name: 'Salary', color: '#153D32' },
      account: { id: 'a1', name: 'Main Bank' },
    },
    // Another user's transaction (must never leak into USER_ID queries)
    {
      id: 't_other',
      userId: OTHER_USER_ID,
      accountId: 'a_other',
      categoryId: 'c_sal',
      title: 'Other User Income',
      amount: 999999,
      type: 'INCOME',
      date: new Date('2026-11-02T00:00:00Z'),
      category: { id: 'c_sal', name: 'Salary', color: '#153D32' },
      account: { id: 'a_other', name: 'Other Bank' },
    },
  ];

  Object.assign(prisma, {
    session: {
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === tokenHash
          ? {
              id: 's-analytics',
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
      findMany: vi.fn(async ({ where }: { where: { userId: string } }) =>
        where.userId === USER_ID
          ? [{ id: 'a1', userId: USER_ID, name: 'Main Bank', openingBalance: 5000 }]
          : [],
      ),
    },
    transaction: {
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: { userId: string; date?: { gte?: Date; lte?: Date } };
        }) =>
          txs.filter((t) => {
            if (t.userId !== where.userId) return false;
            if (where.date?.gte && t.date < where.date.gte) return false;
            if (where.date?.lte && t.date > where.date.lte) return false;
            return true;
          }),
      ),
    },
    budget: {
      findMany: vi.fn(async () => [
        {
          id: 'b1',
          userId: USER_ID,
          categoryId: 'c_food',
          limitAmount: 12000,
          month: '2026-11',
          category: { id: 'c_food', name: 'Food' },
        },
      ]),
    },
    savingsGoal: {
      findMany: vi.fn(async () => [
        {
          id: 'g1',
          userId: USER_ID,
          title: 'Emergency Fund',
          targetAmount: 50000,
          currentAmount: 25000,
          deadline: new Date('2027-01-01'),
          isCompleted: false,
        },
      ]),
    },
    recurringPayment: {
      findMany: vi.fn(async () => []),
    },
  });
}

describe('Finora Dashboard, Analytics, Reports & Calendar API', () => {
  const app = createApp();
  const auth = { Cookie: 'finora_sid=analytics-token-123456' };

  beforeEach(() => {
    setupAnalyticsMock();
  });

  it('computes dashboard KPIs, comparisons, and excludes transfers & other users', async () => {
    const res = await request(app).get('/api/v1/dashboard?month=2026-11').set(auth);
    expect(res.status).toBe(200);
    // Balance = 5,000 opening + 50,000 + 40,000 - 10,000 = 85,000
    expect(res.body.kpis.totalBalance).toBe(85000);
    expect(res.body.kpis.totalIncome).toBe(50000);
    expect(res.body.kpis.totalExpenses).toBe(10000);
    expect(res.body.kpis.savingsRate).toBe(80);
    expect(res.body.kpis.incomeChangePct).toBe(25); // 50k vs 40k
    expect(res.body.budgetSummary.totalSpent).toBe(10000);
    expect(res.body.savingsGoals[0].progressPct).toBe(50);
  });

  it('computes analytics, reports, CSV export, PDF export, and calendar', async () => {
    const analyticsRes = await request(app)
      .get('/api/v1/analytics?startDate=2026-11-01&endDate=2026-11-30')
      .set(auth);
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.summary.netCashFlow).toBe(40000);
    expect(analyticsRes.body.highestSpendingCategory.name).toBe('Food');

    const reportRes = await request(app)
      .get('/api/v1/reports?scope=monthly&month=2026-11')
      .set(auth);
    expect(reportRes.status).toBe(200);
    expect(reportRes.body.summary.income).toBe(50000);

    const pdfRes = await request(app)
      .get('/api/v1/reports/export/pdf?scope=monthly&month=2026-11')
      .set(auth);
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(pdfRes.body.toString('utf8', 0, 8)).toBe('%PDF-1.4');

    const calRes = await request(app).get('/api/v1/calendar?month=2026-11').set(auth);
    expect(calRes.status).toBe(200);
    expect(calRes.body.dailyTotals.length).toBe(3);
  });
});
