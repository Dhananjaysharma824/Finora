import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { sanitizeCsvCell } from '../../utils/money.js';
import { assertAccessibleCategory, assertOwnedAccount } from '../../utils/ownership.js';

export interface CreateTransactionInput {
  title: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  currency: string;
  accountId: string;
  toAccountId?: string;
  categoryId: string;
  date: string;
  notes?: string;
  idempotencyKey?: string;
}

export interface ListTransactionsQuery {
  search?: string;
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  categoryId?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  sortBy: 'date' | 'amount' | 'title' | 'createdAt';
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

function buildWhere(userId: string, q: Partial<ListTransactionsQuery>): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = { userId };
  if (q.type) where.type = q.type;
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.accountId) {
    where.OR = [{ accountId: q.accountId }, { toAccountId: q.accountId }];
  }
  if (q.startDate || q.endDate) {
    where.date = {
      ...(q.startDate ? { gte: new Date(`${q.startDate}T00:00:00.000Z`) } : {}),
      ...(q.endDate ? { lte: new Date(`${q.endDate}T23:59:59.999Z`) } : {}),
    };
  }
  if (q.search) {
    where.AND = [
      {
        OR: [
          { title: { contains: q.search, mode: 'insensitive' } },
          { notes: { contains: q.search, mode: 'insensitive' } },
        ],
      },
    ];
  }
  return where;
}

export const transactionsService = {
  async create(userId: string, input: CreateTransactionInput) {
    return prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.transaction.findFirst({
          where: { userId, idempotencyKey: input.idempotencyKey },
          include: { category: true, account: true, toAccount: true },
        });
        if (existing) {
          return { ...existing, amount: Number(existing.amount), deduplicated: true };
        }
      }

      const fromAccount = await assertOwnedAccount(tx, input.accountId, userId);
      if (fromAccount.currency !== input.currency) {
        throw new AppError(
          'Transaction currency must match the account currency',
          400,
          'CURRENCY_MISMATCH',
        );
      }

      if (input.type === 'TRANSFER') {
        if (!input.toAccountId || input.toAccountId === input.accountId) {
          throw new AppError(
            'Transfer requires a different destination account',
            400,
            'INVALID_TRANSFER',
          );
        }
        const toAccount = await assertOwnedAccount(tx, input.toAccountId, userId);
        if (fromAccount.currency !== toAccount.currency) {
          throw new AppError(
            'Cross-currency transfers are not supported yet',
            400,
            'CROSS_CURRENCY_NOT_SUPPORTED',
          );
        }
      }

      const category = await assertAccessibleCategory(tx, input.categoryId, userId);
      if (category.type !== input.type) {
        throw new AppError(
          `Category type (${category.type}) does not match transaction type (${input.type})`,
          400,
          'CATEGORY_TYPE_MISMATCH',
        );
      }

      const created = await tx.transaction.create({
        data: {
          userId,
          accountId: input.accountId,
          toAccountId: input.type === 'TRANSFER' ? input.toAccountId : null,
          categoryId: input.categoryId,
          title: input.title,
          amount: input.amount,
          type: input.type,
          currency: input.currency,
          date: new Date(input.date),
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
        },
        include: { category: true, account: true, toAccount: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'TRANSACTION_CREATED',
          entityType: 'Transaction',
          entityId: created.id,
        },
      });

      return { ...created, amount: Number(created.amount), deduplicated: false };
    });
  },

  async list(userId: string, q: ListTransactionsQuery) {
    const where = buildWhere(userId, q);
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { category: true, account: true, toAccount: true },
        orderBy: { [q.sortBy]: q.sortOrder },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map((t) => ({ ...t, amount: Number(t.amount) })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  },

  async getById(userId: string, id: string) {
    const tx = await prisma.transaction.findFirst({
      where: { id, userId },
      include: { category: true, account: true, toAccount: true },
    });
    if (!tx) {
      throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
    }
    return { ...tx, amount: Number(tx.amount) };
  },

  async update(
    userId: string,
    id: string,
    input: Partial<Omit<CreateTransactionInput, 'idempotencyKey' | 'toAccountId' | 'notes'>> & {
      toAccountId?: string | null;
      notes?: string | null;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: { id, userId },
      });
      if (!existing) {
        throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
      }

      const nextType = input.type ?? existing.type;
      const nextAccountId = input.accountId ?? existing.accountId;
      const nextToAccountId =
        nextType === 'TRANSFER'
          ? input.toAccountId === undefined
            ? existing.toAccountId
            : input.toAccountId
          : null;
      const nextCategoryId = input.categoryId ?? existing.categoryId;
      const nextCurrency = input.currency ?? existing.currency;

      const fromAccount = await assertOwnedAccount(tx, nextAccountId, userId);
      if (fromAccount.currency !== nextCurrency) {
        throw new AppError('Transaction currency must match account currency', 400, 'CURRENCY_MISMATCH');
      }

      if (nextType === 'TRANSFER') {
        if (!nextToAccountId || nextToAccountId === nextAccountId) {
          throw new AppError(
            'Transfer requires a different destination account',
            400,
            'INVALID_TRANSFER',
          );
        }
        const toAccount = await assertOwnedAccount(tx, nextToAccountId, userId);
        if (fromAccount.currency !== toAccount.currency) {
          throw new AppError(
            'Cross-currency transfers are not supported yet',
            400,
            'CROSS_CURRENCY_NOT_SUPPORTED',
          );
        }
      }

      const category = await assertAccessibleCategory(tx, nextCategoryId, userId);
      if (category.type !== nextType) {
        throw new AppError(
          `Category type (${category.type}) does not match transaction type (${nextType})`,
          400,
          'CATEGORY_TYPE_MISMATCH',
        );
      }

      const updated = await tx.transaction.update({
        where: { id: existing.id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.amount !== undefined ? { amount: input.amount } : {}),
          type: nextType,
          currency: nextCurrency,
          accountId: nextAccountId,
          toAccountId: nextToAccountId,
          categoryId: nextCategoryId,
          ...(input.date !== undefined ? { date: new Date(input.date) } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
        include: { category: true, account: true, toAccount: true },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'TRANSACTION_UPDATED',
          entityType: 'Transaction',
          entityId: updated.id,
        },
      });

      return { ...updated, amount: Number(updated.amount) };
    });
  },

  async remove(userId: string, id: string) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: { id, userId },
      });
      if (!existing) {
        throw new AppError('Transaction not found', 404, 'TRANSACTION_NOT_FOUND');
      }
      await tx.transaction.delete({ where: { id: existing.id } });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'TRANSACTION_DELETED',
          entityType: 'Transaction',
          entityId: existing.id,
        },
      });
    });
  },

  async exportCsv(userId: string, q: Partial<ListTransactionsQuery>): Promise<string> {
    const where = buildWhere(userId, q);
    const rows = await prisma.transaction.findMany({
      where,
      include: { category: true, account: true },
      orderBy: { date: 'desc' },
      take: 5000,
    });

    const header = ['Title', 'Type', 'Category', 'Account', 'Currency', 'Date', 'Amount', 'Notes'];
    const csvLines = rows.map((tx) => [
      sanitizeCsvCell(tx.title),
      sanitizeCsvCell(tx.type),
      sanitizeCsvCell(tx.category.name),
      sanitizeCsvCell(tx.account.name),
      sanitizeCsvCell(tx.currency),
      sanitizeCsvCell(tx.date.toISOString().slice(0, 10)),
      Number(tx.amount).toFixed(2),
      sanitizeCsvCell(tx.notes ?? ''),
    ]);

    return [header.join(','), ...csvLines.map((line) => line.join(','))].join('\n');
  },

  async importBatch(userId: string, items: CreateTransactionInput[]) {
    const createdIds: string[] = [];
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const fromAccount = await assertOwnedAccount(tx, item.accountId, userId);
        if (fromAccount.currency !== item.currency) {
          throw new AppError('Imported transaction currency mismatch', 400, 'CURRENCY_MISMATCH');
        }
        if (item.type === 'TRANSFER') {
          if (!item.toAccountId || item.toAccountId === item.accountId) {
            throw new AppError('Invalid transfer destination in import', 400, 'INVALID_TRANSFER');
          }
          const toAccount = await assertOwnedAccount(tx, item.toAccountId, userId);
          if (fromAccount.currency !== toAccount.currency) {
            throw new AppError('Cross-currency transfers are not supported', 400, 'CROSS_CURRENCY_NOT_SUPPORTED');
          }
        }
        const category = await assertAccessibleCategory(tx, item.categoryId, userId);
        if (category.type !== item.type) {
          throw new AppError('Imported category type mismatch', 400, 'CATEGORY_TYPE_MISMATCH');
        }

        const created = await tx.transaction.create({
          data: {
            userId,
            accountId: item.accountId,
            toAccountId: item.type === 'TRANSFER' ? item.toAccountId : null,
            categoryId: item.categoryId,
            title: item.title,
            amount: item.amount,
            type: item.type,
            currency: item.currency,
            date: new Date(item.date),
            notes: item.notes,
          },
          select: { id: true },
        });
        createdIds.push(created.id);
      }
    });
    return { importedCount: createdIds.length };
  },
};
