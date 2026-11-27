import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { centsToMajor, decimalToCents } from '../../utils/money.js';
import { assertAccessibleCategory, assertOwnedAccount } from '../../utils/ownership.js';

export type RecurringFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export function advanceDueDate(date: Date, frequency: RecurringFrequency): Date {
  const next = new Date(date.getTime());
  switch (frequency) {
    case 'WEEKLY':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case 'YEARLY':
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
  }
  return next;
}

export const recurringService = {
  async list(userId: string) {
    const items = await prisma.recurringPayment.findMany({
      where: { userId },
      include: { category: true, account: true },
      orderBy: { nextPaymentDate: 'asc' },
    });

    let monthlyCents = 0;
    let annualCents = 0;
    let activeCount = 0;

    for (const item of items) {
      if (!item.isActive) continue;
      activeCount += 1;
      const amt = decimalToCents(item.amount);
      switch (item.frequency) {
        case 'WEEKLY':
          monthlyCents += Math.round((amt * 52) / 12);
          annualCents += amt * 52;
          break;
        case 'MONTHLY':
          monthlyCents += amt;
          annualCents += amt * 12;
          break;
        case 'QUARTERLY':
          monthlyCents += Math.round(amt / 3);
          annualCents += amt * 4;
          break;
        case 'YEARLY':
          monthlyCents += Math.round(amt / 12);
          annualCents += amt;
          break;
      }
    }

    return {
      items: items.map((i) => ({ ...i, amount: Number(i.amount) })),
      summary: {
        monthlyRecurringTotal: centsToMajor(monthlyCents),
        annualRecurringTotal: centsToMajor(annualCents),
        activeCount,
      },
    };
  },

  async upcoming(userId: string, withinDays = 14) {
    const now = new Date();
    const cutoff = new Date(now.getTime() + withinDays * 86400000);
    const items = await prisma.recurringPayment.findMany({
      where: {
        userId,
        isActive: true,
        nextPaymentDate: { lte: cutoff },
      },
      include: { category: true, account: true },
      orderBy: { nextPaymentDate: 'asc' },
    });
    return items.map((i) => ({ ...i, amount: Number(i.amount) }));
  },

  async create(
    userId: string,
    input: {
      title: string;
      amount: number;
      accountId: string;
      categoryId: string;
      frequency: RecurringFrequency;
      nextPaymentDate: string;
      isActive: boolean;
      notes?: string;
    },
  ) {
    await assertOwnedAccount(prisma, input.accountId, userId);
    const cat = await assertAccessibleCategory(prisma, input.categoryId, userId);
    if (cat.type !== 'EXPENSE') {
      throw new AppError('Recurring payments require an EXPENSE category', 400, 'INVALID_CATEGORY_TYPE');
    }

    const created = await prisma.recurringPayment.create({
      data: {
        userId,
        title: input.title,
        amount: input.amount,
        accountId: input.accountId,
        categoryId: input.categoryId,
        frequency: input.frequency,
        nextPaymentDate: new Date(input.nextPaymentDate),
        isActive: input.isActive,
        notes: input.notes,
      },
      include: { category: true, account: true },
    });
    return { ...created, amount: Number(created.amount) };
  },

  async update(
    userId: string,
    id: string,
    input: {
      title?: string;
      amount?: number;
      accountId?: string;
      categoryId?: string;
      frequency?: RecurringFrequency;
      nextPaymentDate?: string;
      isActive?: boolean;
      notes?: string | null;
    },
  ) {
    const existing = await prisma.recurringPayment.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new AppError('Recurring payment not found', 404, 'RECURRING_NOT_FOUND');
    }
    if (input.accountId) {
      await assertOwnedAccount(prisma, input.accountId, userId);
    }
    if (input.categoryId) {
      const cat = await assertAccessibleCategory(prisma, input.categoryId, userId);
      if (cat.type !== 'EXPENSE') {
        throw new AppError('Recurring payments require an EXPENSE category', 400, 'INVALID_CATEGORY_TYPE');
      }
    }

    const updated = await prisma.recurringPayment.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
        ...(input.nextPaymentDate !== undefined
          ? { nextPaymentDate: new Date(input.nextPaymentDate) }
          : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      include: { category: true, account: true },
    });
    return { ...updated, amount: Number(updated.amount) };
  },

  async setActive(userId: string, id: string, isActive: boolean) {
    return this.update(userId, id, { isActive });
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.recurringPayment.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new AppError('Recurring payment not found', 404, 'RECURRING_NOT_FOUND');
    }
    await prisma.recurringPayment.delete({ where: { id: existing.id } });
  },

  async markPaid(userId: string, id: string, idempotencyKey?: string) {
    return prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const dup = await tx.transaction.findFirst({
          where: { userId, idempotencyKey },
        });
        if (dup) {
          const item = await tx.recurringPayment.findFirstOrThrow({
            where: { id, userId },
            include: { category: true, account: true },
          });
          return {
            recurringPayment: { ...item, amount: Number(item.amount) },
            transaction: { ...dup, amount: Number(dup.amount) },
            deduplicated: true,
          };
        }
      }

      const item = await tx.recurringPayment.findFirst({
        where: { id, userId },
        include: { account: true },
      });
      if (!item) {
        throw new AppError('Recurring payment not found', 404, 'RECURRING_NOT_FOUND');
      }

      const now = new Date();
      const createdTx = await tx.transaction.create({
        data: {
          userId,
          accountId: item.accountId,
          categoryId: item.categoryId,
          recurringPaymentId: item.id,
          title: item.title,
          amount: item.amount,
          type: 'EXPENSE',
          currency: item.account.currency,
          date: now,
          notes: `Recorded from recurring reminder (${item.frequency})`,
          idempotencyKey,
        },
      });

      const nextDate = advanceDueDate(item.nextPaymentDate, item.frequency);
      const updatedItem = await tx.recurringPayment.update({
        where: { id: item.id },
        data: {
          lastPaidDate: now,
          nextPaymentDate: nextDate,
        },
        include: { category: true, account: true },
      });

      return {
        recurringPayment: { ...updatedItem, amount: Number(updatedItem.amount) },
        transaction: { ...createdTx, amount: Number(createdTx.amount) },
        deduplicated: false,
      };
    });
  },
};
