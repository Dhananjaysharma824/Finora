import { describe, expect, it } from 'vitest';
import {
  computeAccountBalance,
  computeBudgetStats,
  computeGoalProgress,
  computePeriodSummary,
  computeTotalBalance,
} from '@/utils/calculations';
import { calculateSavingsRate, formatMoney, toPaise } from '@/utils/money';
import type { Account, Budget, SavingsGoal, Transaction } from '@/types/finance';

describe('Finora financial calculations', () => {
  const accounts: Account[] = [
    {
      id: 'acc_1',
      name: 'Main Bank',
      type: 'bank',
      openingBalancePaise: 1000000, // ₹10,000
      color: '#153D32',
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'acc_2',
      name: 'Savings',
      type: 'savings',
      openingBalancePaise: 500000, // ₹5,000
      color: '#2F765B',
      createdAt: '2026-11-01T00:00:00Z',
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 't1',
      title: 'Salary',
      amountPaise: 4500000,
      type: 'income',
      category: 'salary',
      accountId: 'acc_1',
      date: '2026-11-01',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 't2',
      title: 'Groceries',
      amountPaise: 250000,
      type: 'expense',
      category: 'food',
      accountId: 'acc_1',
      date: '2026-11-05',
      createdAt: '2026-11-05T00:00:00Z',
      updatedAt: '2026-11-05T00:00:00Z',
    },
    {
      id: 't3',
      title: 'Internal Transfer',
      amountPaise: 1000000,
      type: 'transfer',
      category: 'transfer',
      accountId: 'acc_1',
      toAccountId: 'acc_2',
      date: '2026-11-10',
      createdAt: '2026-11-10T00:00:00Z',
      updatedAt: '2026-11-10T00:00:00Z',
    },
  ];

  it('computes total balance without counting internal transfers as income or expense', () => {
    // Opening: 10,000 + 5,000 = 15,000; + 45,000 income - 2,500 expense = 57,500
    expect(computeTotalBalance(accounts, transactions)).toBe(5750000);
    // acc_1: 10,000 + 45,000 - 2,500 - 10,000 transfer out = 42,500
    expect(computeAccountBalance(accounts[0], transactions)).toBe(4250000);
    // acc_2: 5,000 + 10,000 transfer in = 15,000
    expect(computeAccountBalance(accounts[1], transactions)).toBe(1500000);
  });

  it('computes period summary and savings rate safely including zero income', () => {
    const summary = computePeriodSummary(transactions);
    expect(summary.incomePaise).toBe(4500000);
    expect(summary.expensePaise).toBe(250000);
    expect(summary.netCashFlowPaise).toBe(4250000);
    expect(summary.savingsRate).toBe(94.4);
    expect(calculateSavingsRate(0, 50000)).toBe(0);
  });

  it('computes budget utilization and status thresholds', () => {
    const budgets: Budget[] = [
      { id: 'b1', category: 'food', limitPaise: 300000, month: '2026-11', createdAt: '' },
      { id: 'b2', category: 'food', limitPaise: 250000, month: '2026-11', createdAt: '' },
    ];
    const stats = computeBudgetStats(budgets, transactions);
    expect(stats[0].status).toBe('warning'); // 2500 / 3000 = 83.3%
    expect(stats[1].status).toBe('exceeded'); // 2500 / 2500 = 100%
  });

  it('computes goal progress safely', () => {
    const goal: SavingsGoal = {
      id: 'g1',
      title: 'Emergency',
      targetPaise: 5000000,
      currentPaise: 3850000,
      deadline: '2027-01-01',
      createdAt: '',
    };
    const progress = computeGoalProgress(goal);
    expect(progress.progressPct).toBe(77);
    expect(progress.remainingPaise).toBe(1150000);
    expect(progress.isCompleted).toBe(false);
  });

  it('formats INR currency with integer paise precision', () => {
    expect(toPaise(84250)).toBe(8425000);
    expect(formatMoney(8425000, { currency: 'INR', numberFormat: 'en-IN' })).toBe('₹84,250.00');
  });
});
