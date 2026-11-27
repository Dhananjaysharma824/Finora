import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { centsToMajor, decimalToCents } from '../../utils/money.js';
import { assertOwnedAccount } from '../../utils/ownership.js';

export async function calculateAccountBalance(accountId: string, openingBalance: unknown): Promise<number> {
  const txs = await prisma.transaction.findMany({
    where: {
      OR: [{ accountId }, { toAccountId: accountId }],
    },
    select: {
      accountId: true,
      toAccountId: true,
      type: true,
      amount: true,
    },
  });

  let balanceCents = decimalToCents(openingBalance);
  for (const tx of txs) {
    const amtCents = decimalToCents(tx.amount);
    if (tx.type === 'INCOME' && tx.accountId === accountId) {
      balanceCents += amtCents;
    } else if (tx.type === 'EXPENSE' && tx.accountId === accountId) {
      balanceCents -= amtCents;
    } else if (tx.type === 'TRANSFER') {
      if (tx.accountId === accountId) balanceCents -= amtCents;
      if (tx.toAccountId === accountId) balanceCents += amtCents;
    }
  }
  return centsToMajor(balanceCents);
}

export const accountsService = {
  async list(userId: string) {
    const accounts = await prisma.account.findMany({
      where: { userId, isArchived: false },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      accounts.map(async (acc) => ({
        ...acc,
        openingBalance: Number(acc.openingBalance),
        balance: await calculateAccountBalance(acc.id, acc.openingBalance),
      })),
    );
  },

  async create(
    userId: string,
    input: {
      name: string;
      type: 'BANK' | 'SAVINGS' | 'CASH' | 'WALLET';
      currency: string;
      openingBalance: number;
      institution?: string;
      lastFour?: string;
      color: string;
    },
  ) {
    const created = await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          userId,
          name: input.name,
          type: input.type,
          currency: input.currency,
          openingBalance: input.openingBalance,
          institution: input.institution,
          lastFour: input.lastFour,
          color: input.color,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'ACCOUNT_CREATED',
          entityType: 'Account',
          entityId: account.id,
        },
      });
      return account;
    });

    return {
      ...created,
      openingBalance: Number(created.openingBalance),
      balance: Number(created.openingBalance),
    };
  },

  async getById(userId: string, accountId: string) {
    const account = await assertOwnedAccount(prisma, accountId, userId);
    const balance = await calculateAccountBalance(account.id, account.openingBalance);
    return {
      ...account,
      openingBalance: Number(account.openingBalance),
      balance,
    };
  },

  async update(
    userId: string,
    accountId: string,
    input: {
      name?: string;
      type?: 'BANK' | 'SAVINGS' | 'CASH' | 'WALLET';
      institution?: string | null;
      lastFour?: string | null;
      color?: string;
    },
  ) {
    await assertOwnedAccount(prisma, accountId, userId);
    const updated = await prisma.account.update({
      where: { id: accountId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.institution !== undefined ? { institution: input.institution } : {}),
        ...(input.lastFour !== undefined ? { lastFour: input.lastFour } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });
    const balance = await calculateAccountBalance(updated.id, updated.openingBalance);
    return {
      ...updated,
      openingBalance: Number(updated.openingBalance),
      balance,
    };
  },

  async archive(userId: string, accountId: string) {
    await assertOwnedAccount(prisma, accountId, userId);
    const activeCount = await prisma.account.count({
      where: { userId, isArchived: false },
    });
    if (activeCount <= 1) {
      throw new AppError('At least one active account is required', 400, 'LAST_ACCOUNT');
    }
    await prisma.account.update({
      where: { id: accountId },
      data: { isArchived: true },
    });
  },

  async getTransactions(userId: string, accountId: string, page = 1, pageSize = 20) {
    await assertOwnedAccount(prisma, accountId, userId);
    const safePage = Math.max(1, page);
    const safeSize = Math.min(Math.max(1, pageSize), 100);

    const where = {
      userId,
      OR: [{ accountId }, { toAccountId: accountId }],
    };

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { category: true },
        orderBy: { date: 'desc' },
        skip: (safePage - 1) * safeSize,
        take: safeSize,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      items: items.map((t) => ({ ...t, amount: Number(t.amount) })),
      total,
      page: safePage,
      pageSize: safeSize,
    };
  },
};
