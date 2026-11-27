import { parseISO, startOfMonth, endOfMonth, format, eachDayOfInterval, subMonths } from 'date-fns';
import type {
  Account,
  Budget,
  CategoryId,
  ExpenseCategoryId,
  RecurringPayment,
  SavingsGoal,
  Transaction,
} from '@/types/finance';
import { calculatePercentageChange, calculateSavingsRate } from './money';
import { getCategoryMeta } from './categories';

export function computeAccountBalance(account: Account, transactions: Transaction[]): number {
  let balance = account.openingBalancePaise;
  for (const tx of transactions) {
    if (tx.type === 'income' && tx.accountId === account.id) {
      balance += tx.amountPaise;
    } else if (tx.type === 'expense' && tx.accountId === account.id) {
      balance -= tx.amountPaise;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === account.id) {
        balance -= tx.amountPaise;
      }
      if (tx.toAccountId === account.id) {
        balance += tx.amountPaise;
      }
    }
  }
  return balance;
}

export function computeTotalBalance(accounts: Account[], transactions: Transaction[]): number {
  const opening = accounts.reduce((sum, a) => sum + a.openingBalancePaise, 0);
  let net = 0;
  for (const tx of transactions) {
    if (tx.type === 'income') net += tx.amountPaise;
    else if (tx.type === 'expense') net -= tx.amountPaise;
    // Transfers do not affect total balance
  }
  return opening + net;
}

export function filterTransactionsByMonth(transactions: Transaction[], monthKey: string): Transaction[] {
  return transactions.filter((tx) => tx.date.startsWith(monthKey));
}

export function filterTransactionsByRange(
  transactions: Transaction[],
  startDate: string,
  endDate: string,
): Transaction[] {
  return transactions.filter((tx) => tx.date >= startDate && tx.date <= endDate);
}

export interface PeriodSummary {
  incomePaise: number;
  expensePaise: number;
  netCashFlowPaise: number;
  savingsRate: number;
  transactionCount: number;
}

export function computePeriodSummary(transactions: Transaction[]): PeriodSummary {
  let incomePaise = 0;
  let expensePaise = 0;
  for (const tx of transactions) {
    if (tx.type === 'income') incomePaise += tx.amountPaise;
    else if (tx.type === 'expense') expensePaise += tx.amountPaise;
  }
  return {
    incomePaise,
    expensePaise,
    netCashFlowPaise: incomePaise - expensePaise,
    savingsRate: calculateSavingsRate(incomePaise, expensePaise),
    transactionCount: transactions.length,
  };
}

export interface MonthlyKpiComparison {
  totalBalancePaise: number;
  current: PeriodSummary;
  previous: PeriodSummary;
  incomeChangePct: number | null;
  expenseChangePct: number | null;
  savingsRateDelta: number;
}

export function computeMonthlyKpis(
  accounts: Account[],
  transactions: Transaction[],
  monthKey: string,
): MonthlyKpiComparison {
  const parsed = parseISO(`${monthKey}-01`);
  const prevMonthKey = format(subMonths(parsed, 1), 'yyyy-MM');

  const currentTxs = filterTransactionsByMonth(transactions, monthKey);
  const previousTxs = filterTransactionsByMonth(transactions, prevMonthKey);

  const current = computePeriodSummary(currentTxs);
  const previous = computePeriodSummary(previousTxs);

  return {
    totalBalancePaise: computeTotalBalance(accounts, transactions),
    current,
    previous,
    incomeChangePct: calculatePercentageChange(current.incomePaise, previous.incomePaise),
    expenseChangePct: calculatePercentageChange(current.expensePaise, previous.expensePaise),
    savingsRateDelta: Math.round((current.savingsRate - previous.savingsRate) * 10) / 10,
  };
}

export interface CategoryBreakdownItem {
  category: CategoryId;
  label: string;
  color: string;
  amountPaise: number;
  percentage: number;
  count: number;
}

export function computeCategoryBreakdown(
  transactions: Transaction[],
  type: 'expense' | 'income' = 'expense',
): CategoryBreakdownItem[] {
  const filtered = transactions.filter((t) => t.type === type);
  const total = filtered.reduce((sum, t) => sum + t.amountPaise, 0);
  const map = new Map<CategoryId, { amountPaise: number; count: number }>();

  for (const tx of filtered) {
    const existing = map.get(tx.category) ?? { amountPaise: 0, count: 0 };
    map.set(tx.category, {
      amountPaise: existing.amountPaise + tx.amountPaise,
      count: existing.count + 1,
    });
  }

  const items: CategoryBreakdownItem[] = [];
  for (const [category, stats] of map.entries()) {
    const meta = getCategoryMeta(category);
    items.push({
      category,
      label: meta.label,
      color: meta.color,
      amountPaise: stats.amountPaise,
      percentage: total > 0 ? Math.round((stats.amountPaise / total) * 1000) / 10 : 0,
      count: stats.count,
    });
  }

  return items.sort((a, b) => b.amountPaise - a.amountPaise);
}

export interface BudgetWithStats extends Budget {
  spentPaise: number;
  remainingPaise: number;
  utilizationPct: number;
  status: 'healthy' | 'warning' | 'exceeded';
}

export function computeBudgetStats(
  budgets: Budget[],
  transactions: Transaction[],
): BudgetWithStats[] {
  return budgets.map((budget) => {
    const spentPaise = transactions
      .filter(
        (tx) =>
          tx.type === 'expense' &&
          tx.category === budget.category &&
          tx.date.startsWith(budget.month),
      )
      .reduce((sum, tx) => sum + tx.amountPaise, 0);

    const remainingPaise = budget.limitPaise - spentPaise;
    const utilizationPct =
      budget.limitPaise > 0 ? Math.round((spentPaise / budget.limitPaise) * 1000) / 10 : 0;

    let status: BudgetWithStats['status'] = 'healthy';
    if (utilizationPct >= 100) status = 'exceeded';
    else if (utilizationPct >= 80) status = 'warning';

    return {
      ...budget,
      spentPaise,
      remainingPaise,
      utilizationPct,
      status,
    };
  });
}

export function computeGoalProgress(goal: SavingsGoal): {
  progressPct: number;
  remainingPaise: number;
  isCompleted: boolean;
} {
  const remainingPaise = Math.max(0, goal.targetPaise - goal.currentPaise);
  const progressPct =
    goal.targetPaise > 0
      ? Math.min(100, Math.round((goal.currentPaise / goal.targetPaise) * 1000) / 10)
      : 0;
  return {
    progressPct,
    remainingPaise,
    isCompleted: goal.currentPaise >= goal.targetPaise && goal.targetPaise > 0,
  };
}

export function computeRecurringTotals(payments: RecurringPayment[]): {
  monthlyTotalPaise: number;
  annualTotalPaise: number;
  activeCount: number;
} {
  let monthlyTotalPaise = 0;
  let annualTotalPaise = 0;
  let activeCount = 0;

  for (const p of payments) {
    if (!p.isActive) continue;
    activeCount += 1;
    switch (p.frequency) {
      case 'weekly':
        monthlyTotalPaise += Math.round((p.amountPaise * 52) / 12);
        annualTotalPaise += p.amountPaise * 52;
        break;
      case 'monthly':
        monthlyTotalPaise += p.amountPaise;
        annualTotalPaise += p.amountPaise * 12;
        break;
      case 'quarterly':
        monthlyTotalPaise += Math.round(p.amountPaise / 3);
        annualTotalPaise += p.amountPaise * 4;
        break;
      case 'yearly':
        monthlyTotalPaise += Math.round(p.amountPaise / 12);
        annualTotalPaise += p.amountPaise;
        break;
    }
  }

  return { monthlyTotalPaise, annualTotalPaise, activeCount };
}

export interface CashFlowPoint {
  label: string;
  dateKey: string;
  income: number;
  expenses: number;
  net: number;
}

export function computeDailyCashFlow(transactions: Transaction[], monthKey: string): CashFlowPoint[] {
  const parsed = parseISO(`${monthKey}-01`);
  const days = eachDayOfInterval({
    start: startOfMonth(parsed),
    end: endOfMonth(parsed),
  });

  const dayMap = new Map<string, { income: number; expenses: number }>();
  for (const tx of transactions) {
    if (!tx.date.startsWith(monthKey)) continue;
    const entry = dayMap.get(tx.date) ?? { income: 0, expenses: 0 };
    if (tx.type === 'income') entry.income += tx.amountPaise;
    else if (tx.type === 'expense') entry.expenses += tx.amountPaise;
    dayMap.set(tx.date, entry);
  }

  return days.map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    const entry = dayMap.get(key) ?? { income: 0, expenses: 0 };
    return {
      label: format(d, 'd MMM'),
      dateKey: key,
      income: entry.income / 100,
      expenses: entry.expenses / 100,
      net: (entry.income - entry.expenses) / 100,
    };
  });
}

export function computeMonthlyCashFlow(
  transactions: Transaction[],
  monthKeys: string[],
): CashFlowPoint[] {
  return monthKeys.map((key) => {
    const txs = filterTransactionsByMonth(transactions, key);
    const summary = computePeriodSummary(txs);
    const parsed = parseISO(`${key}-01`);
    return {
      label: format(parsed, 'MMM yyyy'),
      dateKey: key,
      income: summary.incomePaise / 100,
      expenses: summary.expensePaise / 100,
      net: summary.netCashFlowPaise / 100,
    };
  });
}

export function getSpentForCategoryInMonth(
  transactions: Transaction[],
  category: ExpenseCategoryId,
  monthKey: string,
): number {
  return transactions
    .filter(
      (tx) =>
        tx.type === 'expense' &&
        tx.category === category &&
        tx.date.startsWith(monthKey),
    )
    .reduce((sum, tx) => sum + tx.amountPaise, 0);
}
