import { prisma } from '../../config/database.js';
import { centsToMajor, decimalToCents, sanitizeCsvCell } from '../../utils/money.js';
import { buildSimpleStatementPdf } from '../../utils/pdf.js';
import { computeBudgetStatus } from '../budgets/budgets.service.js';

function monthRangeUtc(monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
  };
}

function prevMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function recentMonthKeys(count: number, anchorMonth: string): string[] {
  const [y, m] = anchorMonth.split('-').map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function calculateSavingsRate(incomeCents: number, expenseCents: number): number {
  if (incomeCents <= 0) return 0;
  return Math.round(((incomeCents - expenseCents) / incomeCents) * 1000) / 10;
}

function percentageChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return Math.round(((curr - prev) / Math.abs(prev)) * 1000) / 10;
}

function summarizeTxs(
  txs: Array<{ type: string; amount: unknown }>,
): { incomeCents: number; expenseCents: number; netCents: number; savingsRate: number } {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const t of txs) {
    const amt = decimalToCents(t.amount);
    if (t.type === 'INCOME') incomeCents += amt;
    else if (t.type === 'EXPENSE') expenseCents += amt;
  }
  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    savingsRate: calculateSavingsRate(incomeCents, expenseCents),
  };
}

export const analyticsService = {
  async getDashboard(userId: string, monthKey: string) {
    const [accounts, allTxs, budgets, goals] = await Promise.all([
      prisma.account.findMany({ where: { userId, isArchived: false } }),
      prisma.transaction.findMany({
        where: { userId },
        include: { category: true, account: true },
        orderBy: { date: 'desc' },
      }),
      prisma.budget.findMany({
        where: { userId, month: monthKey },
        include: { category: true },
      }),
      prisma.savingsGoal.findMany({
        where: { userId },
        orderBy: { deadline: 'asc' },
      }),
    ]);

    // Total balance across accounts (opening + all income - all expenses)
    let totalBalanceCents = accounts.reduce(
      (sum, a) => sum + decimalToCents(a.openingBalance),
      0,
    );
    for (const tx of allTxs) {
      const amt = decimalToCents(tx.amount);
      if (tx.type === 'INCOME') totalBalanceCents += amt;
      else if (tx.type === 'EXPENSE') totalBalanceCents -= amt;
    }

    const currRange = monthRangeUtc(monthKey);
    const prevKey = prevMonthKey(monthKey);
    const prevRange = monthRangeUtc(prevKey);

    const currTxs = allTxs.filter(
      (t) => t.date >= currRange.start && t.date <= currRange.end,
    );
    const prevTxs = allTxs.filter(
      (t) => t.date >= prevRange.start && t.date <= prevRange.end,
    );

    const currSummary = summarizeTxs(currTxs);
    const prevSummary = summarizeTxs(prevTxs);

    // Category expense breakdown
    const catMap = new Map<
      string,
      { categoryId: string; name: string; color: string; cents: number; count: number }
    >();
    for (const tx of currTxs) {
      if (tx.type !== 'EXPENSE') continue;
      const existing = catMap.get(tx.categoryId) ?? {
        categoryId: tx.categoryId,
        name: tx.category.name,
        color: tx.category.color,
        cents: 0,
        count: 0,
      };
      existing.cents += decimalToCents(tx.amount);
      existing.count += 1;
      catMap.set(tx.categoryId, existing);
    }

    const expenseBreakdown = [...catMap.values()]
      .sort((a, b) => b.cents - a.cents)
      .map((c) => ({
        categoryId: c.categoryId,
        name: c.name,
        color: c.color,
        amount: centsToMajor(c.cents),
        percentage:
          currSummary.expenseCents > 0
            ? Math.round((c.cents / currSummary.expenseCents) * 1000) / 10
            : 0,
        count: c.count,
      }));

    // 6-month cash flow series
    const monthKeys = recentMonthKeys(6, monthKey);
    const monthlyCashFlow = monthKeys.map((mk) => {
      const r = monthRangeUtc(mk);
      const s = summarizeTxs(allTxs.filter((t) => t.date >= r.start && t.date <= r.end));
      return {
        month: mk,
        income: centsToMajor(s.incomeCents),
        expenses: centsToMajor(s.expenseCents),
        net: centsToMajor(s.netCents),
      };
    });

    // Budget summary
    const budgetItems = budgets.map((b) => {
      const spentCents = currTxs
        .filter((t) => t.type === 'EXPENSE' && t.categoryId === b.categoryId)
        .reduce((sum, t) => sum + decimalToCents(t.amount), 0);
      const limitCents = decimalToCents(b.limitAmount);
      const util = limitCents > 0 ? Math.round((spentCents / limitCents) * 1000) / 10 : 0;
      return {
        id: b.id,
        categoryName: b.category.name,
        limitAmount: centsToMajor(limitCents),
        spentAmount: centsToMajor(spentCents),
        remainingAmount: centsToMajor(limitCents - spentCents),
        utilizationPct: util,
        status: computeBudgetStatus(util),
      };
    });

    return {
      month: monthKey,
      kpis: {
        totalBalance: centsToMajor(totalBalanceCents),
        totalIncome: centsToMajor(currSummary.incomeCents),
        totalExpenses: centsToMajor(currSummary.expenseCents),
        netCashFlow: centsToMajor(currSummary.netCents),
        savingsRate: currSummary.savingsRate,
        incomeChangePct: percentageChange(currSummary.incomeCents, prevSummary.incomeCents),
        expenseChangePct: percentageChange(currSummary.expenseCents, prevSummary.expenseCents),
        savingsRateDelta:
          Math.round((currSummary.savingsRate - prevSummary.savingsRate) * 10) / 10,
      },
      recentTransactions: allTxs.slice(0, 6).map((t) => ({ ...t, amount: Number(t.amount) })),
      monthlyCashFlow,
      expenseBreakdown,
      budgetSummary: {
        totalBudgeted: centsToMajor(
          budgetItems.reduce((s, b) => s + decimalToCents(b.limitAmount), 0),
        ),
        totalSpent: centsToMajor(
          budgetItems.reduce((s, b) => s + decimalToCents(b.spentAmount), 0),
        ),
        items: budgetItems,
      },
      savingsGoals: goals.slice(0, 4).map((g) => {
        const target = decimalToCents(g.targetAmount);
        const current = decimalToCents(g.currentAmount);
        return {
          id: g.id,
          title: g.title,
          targetAmount: centsToMajor(target),
          currentAmount: centsToMajor(current),
          progressPct: target > 0 ? Math.min(100, Math.round((current / target) * 1000) / 10) : 0,
          deadline: g.deadline,
          isCompleted: g.isCompleted,
        };
      }),
    };
  },

  async getAnalytics(userId: string, startDate: string, endDate: string) {
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    const txs = await prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
      include: { category: true },
      orderBy: { date: 'asc' },
    });

    const summary = summarizeTxs(txs);

    const expenseCatMap = new Map<string, { name: string; color: string; cents: number }>();
    const dailyMap = new Map<string, { incomeCents: number; expenseCents: number }>();

    for (const tx of txs) {
      const amt = decimalToCents(tx.amount);
      const dayKey = tx.date.toISOString().slice(0, 10);
      const dayEntry = dailyMap.get(dayKey) ?? { incomeCents: 0, expenseCents: 0 };
      if (tx.type === 'INCOME') dayEntry.incomeCents += amt;
      if (tx.type === 'EXPENSE') {
        dayEntry.expenseCents += amt;
        const catEntry = expenseCatMap.get(tx.categoryId) ?? {
          name: tx.category.name,
          color: tx.category.color,
          cents: 0,
        };
        catEntry.cents += amt;
        expenseCatMap.set(tx.categoryId, catEntry);
      }
      dailyMap.set(dayKey, dayEntry);
    }

    const categoryBreakdown = [...expenseCatMap.entries()]
      .sort((a, b) => b[1].cents - a[1].cents)
      .map(([categoryId, data]) => ({
        categoryId,
        name: data.name,
        color: data.color,
        amount: centsToMajor(data.cents),
        percentage:
          summary.expenseCents > 0
            ? Math.round((data.cents / summary.expenseCents) * 1000) / 10
            : 0,
      }));

    const dailySeries = [...dailyMap.entries()].map(([date, d]) => ({
      date,
      income: centsToMajor(d.incomeCents),
      expenses: centsToMajor(d.expenseCents),
      net: centsToMajor(d.incomeCents - d.expenseCents),
    }));

    return {
      range: { startDate, endDate },
      summary: {
        income: centsToMajor(summary.incomeCents),
        expenses: centsToMajor(summary.expenseCents),
        netCashFlow: centsToMajor(summary.netCents),
        savingsRate: summary.savingsRate,
        transactionCount: txs.length,
      },
      highestSpendingCategory: categoryBreakdown[0] ?? null,
      categoryBreakdown,
      dailySeries,
    };
  },

  async getReport(userId: string, scope: 'monthly' | 'annual', periodKey: string) {
    const start =
      scope === 'monthly'
        ? monthRangeUtc(periodKey).start
        : new Date(Date.UTC(Number(periodKey), 0, 1, 0, 0, 0, 0));
    const end =
      scope === 'monthly'
        ? monthRangeUtc(periodKey).end
        : new Date(Date.UTC(Number(periodKey), 11, 31, 23, 59, 59, 999));

    const [txs, budgets] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: start, lte: end } },
        include: { category: true },
      }),
      prisma.budget.findMany({
        where: {
          userId,
          ...(scope === 'monthly' ? { month: periodKey } : { month: { startsWith: periodKey } }),
        },
        include: { category: true },
      }),
    ]);

    const summary = summarizeTxs(txs);

    const incomeCats = new Map<string, { name: string; cents: number }>();
    const expenseCats = new Map<string, { name: string; cents: number }>();
    for (const tx of txs) {
      const amt = decimalToCents(tx.amount);
      if (tx.type === 'INCOME') {
        const e = incomeCats.get(tx.categoryId) ?? { name: tx.category.name, cents: 0 };
        e.cents += amt;
        incomeCats.set(tx.categoryId, e);
      } else if (tx.type === 'EXPENSE') {
        const e = expenseCats.get(tx.categoryId) ?? { name: tx.category.name, cents: 0 };
        e.cents += amt;
        expenseCats.set(tx.categoryId, e);
      }
    }

    return {
      scope,
      period: periodKey,
      summary: {
        income: centsToMajor(summary.incomeCents),
        expenses: centsToMajor(summary.expenseCents),
        netCashFlow: centsToMajor(summary.netCents),
        savingsRate: summary.savingsRate,
        transactionCount: txs.length,
      },
      incomeReport: [...incomeCats.values()].map((c) => ({
        name: c.name,
        amount: centsToMajor(c.cents),
      })),
      expenseReport: [...expenseCats.values()]
        .sort((a, b) => b.cents - a.cents)
        .map((c) => ({
          name: c.name,
          amount: centsToMajor(c.cents),
        })),
      budgetPerformance: budgets.map((b) => {
        const spent = txs
          .filter((t) => t.type === 'EXPENSE' && t.categoryId === b.categoryId)
          .reduce((s, t) => s + decimalToCents(t.amount), 0);
        const limit = decimalToCents(b.limitAmount);
        const util = limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0;
        return {
          category: b.category.name,
          month: b.month,
          limit: centsToMajor(limit),
          spent: centsToMajor(spent),
          utilizationPct: util,
          status: computeBudgetStatus(util),
        };
      }),
    };
  },

  async exportReportCsv(userId: string, scope: 'monthly' | 'annual', periodKey: string) {
    const report = await this.getReport(userId, scope, periodKey);
    const lines = [
      `Finora ${scope} Financial Report (${periodKey})`,
      '',
      'Metric,Value',
      `Income,${report.summary.income.toFixed(2)}`,
      `Expenses,${report.summary.expenses.toFixed(2)}`,
      `Net Cash Flow,${report.summary.netCashFlow.toFixed(2)}`,
      `Savings Rate,${report.summary.savingsRate}%`,
      '',
      'Expense Category,Amount',
      ...report.expenseReport.map((c) => `${sanitizeCsvCell(c.name)},${c.amount.toFixed(2)}`),
    ];
    return lines.join('\n');
  },

  async exportReportPdf(userId: string, scope: 'monthly' | 'annual', periodKey: string) {
    const report = await this.getReport(userId, scope, periodKey);
    const lines = [
      `Period: ${periodKey} (${scope})`,
      `Transactions: ${report.summary.transactionCount}`,
      `Total Income: ${report.summary.income.toFixed(2)}`,
      `Total Expenses: ${report.summary.expenses.toFixed(2)}`,
      `Net Cash Flow: ${report.summary.netCashFlow.toFixed(2)}`,
      `Savings Rate: ${report.summary.savingsRate}%`,
      '',
      'Top Expense Categories:',
      ...report.expenseReport.slice(0, 12).map((c) => `  - ${c.name}: ${c.amount.toFixed(2)}`),
    ];
    return buildSimpleStatementPdf('FINORA FINANCIAL STATEMENT', lines);
  },

  async getCalendar(userId: string, monthKey: string) {
    const { start, end } = monthRangeUtc(monthKey);
    const [txs, recurring] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId, date: { gte: start, lte: end } },
        include: { category: true },
        orderBy: { date: 'asc' },
      }),
      prisma.recurringPayment.findMany({
        where: {
          userId,
          isActive: true,
          nextPaymentDate: { gte: start, lte: end },
        },
        include: { category: true },
      }),
    ]);

    const days = new Map<string, { incomeCents: number; expenseCents: number; count: number }>();
    for (const tx of txs) {
      const day = tx.date.toISOString().slice(0, 10);
      const entry = days.get(day) ?? { incomeCents: 0, expenseCents: 0, count: 0 };
      const amt = decimalToCents(tx.amount);
      if (tx.type === 'INCOME') entry.incomeCents += amt;
      else if (tx.type === 'EXPENSE') entry.expenseCents += amt;
      entry.count += 1;
      days.set(day, entry);
    }

    return {
      month: monthKey,
      dailyTotals: [...days.entries()].map(([date, d]) => ({
        date,
        income: centsToMajor(d.incomeCents),
        expenses: centsToMajor(d.expenseCents),
        net: centsToMajor(d.incomeCents - d.expenseCents),
        count: d.count,
      })),
      upcomingRecurring: recurring.map((r) => ({
        ...r,
        amount: Number(r.amount),
      })),
    };
  },
};
