import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { centsToMajor, decimalToCents } from '../../utils/money.js';
import { assertAccessibleCategory } from '../../utils/ownership.js';

export type BudgetStatus = 'HEALTHY' | 'WARNING' | 'EXCEEDED';

export function computeBudgetStatus(utilizationPct: number): BudgetStatus {
  if (utilizationPct >= 100) return 'EXCEEDED';
  if (utilizationPct >= 80) return 'WARNING';
  return 'HEALTHY';
}

function getMonthDateRange(month: string): { start: Date; end: Date } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr);
  const start = new Date(Date.UTC(year, m - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999));
  return { start, end };
}

async function enrichBudget(
  userId: string,
  budget: {
    id: string;
    userId: string;
    categoryId: string;
    limitAmount: unknown;
    month: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    category: { id: string; name: string; slug: string; color: string };
  },
) {
  const { start, end } = getMonthDateRange(budget.month);
  const expenses = await prisma.transaction.findMany({
    where: {
      userId,
      categoryId: budget.categoryId,
      type: 'EXPENSE',
      date: { gte: start, lte: end },
    },
    select: { amount: true },
  });

  const spentCents = expenses.reduce((sum, tx) => sum + decimalToCents(tx.amount), 0);
  const limitCents = decimalToCents(budget.limitAmount);
  const remainingCents = limitCents - spentCents;
  const utilizationPct =
    limitCents > 0 ? Math.round((spentCents / limitCents) * 1000) / 10 : 0;

  return {
    ...budget,
    limitAmount: centsToMajor(limitCents),
    spentAmount: centsToMajor(spentCents),
    remainingAmount: centsToMajor(remainingCents),
    utilizationPct,
    status: computeBudgetStatus(utilizationPct),
  };
}

export const budgetsService = {
  async list(userId: string, month?: string) {
    const budgets = await prisma.budget.findMany({
      where: { userId, ...(month ? { month } : {}) },
      include: { category: true },
      orderBy: [{ month: 'desc' }, { createdAt: 'asc' }],
    });
    return Promise.all(budgets.map((b) => enrichBudget(userId, b)));
  },

  async create(
    userId: string,
    input: { categoryId: string; limitAmount: number; month: string; description?: string },
  ) {
    const category = await assertAccessibleCategory(prisma, input.categoryId, userId);
    if (category.type !== 'EXPENSE') {
      throw new AppError('Budgets can only be set for EXPENSE categories', 400, 'INVALID_CATEGORY_TYPE');
    }

    const existing = await prisma.budget.findFirst({
      where: { userId, categoryId: input.categoryId, month: input.month },
    });
    if (existing) {
      throw new AppError(
        'A budget already exists for this category and month',
        409,
        'BUDGET_EXISTS',
      );
    }

    const created = await prisma.budget.create({
      data: {
        userId,
        categoryId: input.categoryId,
        limitAmount: input.limitAmount,
        month: input.month,
        description: input.description,
      },
      include: { category: true },
    });

    return enrichBudget(userId, created);
  },

  async update(
    userId: string,
    id: string,
    input: { limitAmount?: number; description?: string | null },
  ) {
    const existing = await prisma.budget.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND');
    }

    const updated = await prisma.budget.update({
      where: { id: existing.id },
      data: {
        ...(input.limitAmount !== undefined ? { limitAmount: input.limitAmount } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      },
      include: { category: true },
    });
    return enrichBudget(userId, updated);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.budget.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new AppError('Budget not found', 404, 'BUDGET_NOT_FOUND');
    }
    await prisma.budget.delete({ where: { id: existing.id } });
  },
};
