import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { assertAccessibleCategory, assertOwnedAccount } from '../utils/ownership.js';

describe('Finora Prisma schema & ownership validation', () => {
  it('exposes all required Prisma models in DMMF', () => {
    const modelNames = Prisma.dmmf.datamodel.models.map((m) => m.name);
    const required = [
      'User',
      'Session',
      'EmailVerificationToken',
      'PasswordResetToken',
      'Account',
      'Category',
      'Transaction',
      'Budget',
      'SavingsGoal',
      'GoalContribution',
      'RecurringPayment',
      'Notification',
      'AuditLog',
    ];
    for (const name of required) {
      expect(modelNames).toContain(name);
    }
  });

  it('rejects account access when userId does not match owner', async () => {
    const mockDb = {
      account: { findFirst: vi.fn().mockResolvedValue(null) },
      category: { findFirst: vi.fn() },
    };

    await expect(
      assertOwnedAccount(mockDb as never, 'acc-1', 'attacker-user'),
    ).rejects.toThrow(/Account not found or access denied/);

    expect(mockDb.account.findFirst).toHaveBeenCalledWith({
      where: { id: 'acc-1', userId: 'attacker-user', isArchived: false },
    });
  });

  it('allows owned or shared default category and rejects another user category', async () => {
    const mockDb = {
      account: { findFirst: vi.fn() },
      category: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 'cat-default', userId: null, isDefault: true })
          .mockResolvedValueOnce(null),
      },
    };

    const allowed = await assertAccessibleCategory(mockDb as never, 'cat-default', 'user-1');
    expect(allowed.id).toBe('cat-default');

    await expect(
      assertAccessibleCategory(mockDb as never, 'other-user-cat', 'user-1'),
    ).rejects.toThrow(/Category not found or access denied/);
  });
});
