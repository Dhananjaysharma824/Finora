import type { PrismaClient } from '@prisma/client';
import { AppError } from './AppError.js';

type DbClient = Pick<PrismaClient, 'account' | 'category'>;

export async function assertOwnedAccount(
  db: DbClient,
  accountId: string,
  userId: string,
) {
  const account = await db.account.findFirst({
    where: { id: accountId, userId, isArchived: false },
  });
  if (!account) {
    throw new AppError('Account not found or access denied', 404, 'ACCOUNT_NOT_FOUND');
  }
  return account;
}

export async function assertAccessibleCategory(
  db: DbClient,
  categoryId: string,
  userId: string,
) {
  const category = await db.category.findFirst({
    where: {
      id: categoryId,
      OR: [{ userId }, { isDefault: true, userId: null }],
    },
  });
  if (!category) {
    throw new AppError('Category not found or access denied', 404, 'CATEGORY_NOT_FOUND');
  }
  return category;
}
