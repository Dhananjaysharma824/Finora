import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';
import { centsToMajor, decimalToCents } from '../../utils/money.js';
import { assertOwnedAccount } from '../../utils/ownership.js';

function formatGoal<T extends { targetAmount: unknown; currentAmount: unknown; isCompleted: boolean }>(
  goal: T,
) {
  const targetCents = decimalToCents(goal.targetAmount);
  const currentCents = decimalToCents(goal.currentAmount);
  const remainingCents = Math.max(0, targetCents - currentCents);
  const progressPct =
    targetCents > 0 ? Math.min(100, Math.round((currentCents / targetCents) * 1000) / 10) : 0;

  return {
    ...goal,
    targetAmount: centsToMajor(targetCents),
    currentAmount: centsToMajor(currentCents),
    remainingAmount: centsToMajor(remainingCents),
    progressPct,
    isCompleted: goal.isCompleted || (currentCents >= targetCents && targetCents > 0),
  };
}

export const goalsService = {
  async list(userId: string) {
    const goals = await prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: { deadline: 'asc' },
    });
    return goals.map(formatGoal);
  },

  async create(
    userId: string,
    input: {
      title: string;
      targetAmount: number;
      currentAmount: number;
      deadline: string;
      linkedAccountId?: string;
      notes?: string;
    },
  ) {
    if (input.linkedAccountId) {
      await assertOwnedAccount(prisma, input.linkedAccountId, userId);
    }

    const isCompleted = input.currentAmount >= input.targetAmount;
    const created = await prisma.savingsGoal.create({
      data: {
        userId,
        title: input.title,
        targetAmount: input.targetAmount,
        currentAmount: input.currentAmount,
        deadline: new Date(input.deadline),
        linkedAccountId: input.linkedAccountId,
        notes: input.notes,
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
    });
    return formatGoal(created);
  },

  async update(
    userId: string,
    id: string,
    input: {
      title?: string;
      targetAmount?: number;
      deadline?: string;
      linkedAccountId?: string | null;
      notes?: string | null;
    },
  ) {
    const existing = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new AppError('Savings goal not found', 404, 'GOAL_NOT_FOUND');
    }
    if (input.linkedAccountId) {
      await assertOwnedAccount(prisma, input.linkedAccountId, userId);
    }

    const nextTarget = input.targetAmount ?? Number(existing.targetAmount);
    const isCompleted = Number(existing.currentAmount) >= nextTarget;

    const updated = await prisma.savingsGoal.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.targetAmount !== undefined ? { targetAmount: input.targetAmount } : {}),
        ...(input.deadline !== undefined ? { deadline: new Date(input.deadline) } : {}),
        ...(input.linkedAccountId !== undefined ? { linkedAccountId: input.linkedAccountId } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        isCompleted,
        completedAt: isCompleted ? existing.completedAt ?? new Date() : null,
      },
    });
    return formatGoal(updated);
  },

  async remove(userId: string, id: string) {
    const existing = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!existing) {
      throw new AppError('Savings goal not found', 404, 'GOAL_NOT_FOUND');
    }
    await prisma.savingsGoal.delete({ where: { id: existing.id } });
  },

  async contribute(
    userId: string,
    goalId: string,
    input: { amount: number; sourceAccountId?: string; notes?: string; idempotencyKey?: string },
  ) {
    return prisma.$transaction(async (tx) => {
      if (input.idempotencyKey) {
        const dup = await tx.goalContribution.findFirst({
          where: { userId, idempotencyKey: input.idempotencyKey },
        });
        if (dup) {
          const goal = await tx.savingsGoal.findFirstOrThrow({ where: { id: goalId, userId } });
          return {
            contribution: { ...dup, amount: Number(dup.amount) },
            goal: formatGoal(goal),
            deduplicated: true,
          };
        }
      }

      const goal = await tx.savingsGoal.findFirst({ where: { id: goalId, userId } });
      if (!goal) {
        throw new AppError('Savings goal not found', 404, 'GOAL_NOT_FOUND');
      }

      if (input.sourceAccountId) {
        await assertOwnedAccount(tx, input.sourceAccountId, userId);
      }

      const prevCents = decimalToCents(goal.currentAmount);
      const addCents = decimalToCents(input.amount);
      const targetCents = decimalToCents(goal.targetAmount);
      const nextCents = prevCents + addCents;
      const isCompleted = nextCents >= targetCents && targetCents > 0;

      const contribution = await tx.goalContribution.create({
        data: {
          userId,
          goalId: goal.id,
          sourceAccountId: input.sourceAccountId,
          amount: input.amount,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
        },
      });

      const updatedGoal = await tx.savingsGoal.update({
        where: { id: goal.id },
        data: {
          currentAmount: centsToMajor(nextCents),
          isCompleted,
          completedAt: isCompleted ? goal.completedAt ?? new Date() : null,
        },
      });

      const prevPct = targetCents > 0 ? (prevCents / targetCents) * 100 : 0;
      const nextPct = targetCents > 0 ? (nextCents / targetCents) * 100 : 0;
      if (prevPct < 100 && nextPct >= 100) {
        await tx.notification.create({
          data: {
            userId,
            type: 'GOAL_MILESTONE',
            title: `Goal achieved: ${goal.title}`,
            message: `You reached 100% of your ${goal.title} target.`,
            linkTo: '/goals',
          },
        });
      }

      return {
        contribution: { ...contribution, amount: Number(contribution.amount) },
        goal: formatGoal(updatedGoal),
        deduplicated: false,
      };
    });
  },

  async listContributions(userId: string, goalId: string) {
    const goal = await prisma.savingsGoal.findFirst({ where: { id: goalId, userId } });
    if (!goal) {
      throw new AppError('Savings goal not found', 404, 'GOAL_NOT_FOUND');
    }
    const items = await prisma.goalContribution.findMany({
      where: { userId, goalId },
      orderBy: { contributedAt: 'desc' },
    });
    return items.map((c) => ({ ...c, amount: Number(c.amount) }));
  },
};
