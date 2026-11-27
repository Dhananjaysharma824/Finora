import { beforeEach, describe, expect, it } from 'vitest';
import { useFinoraStore } from '@/stores/useFinoraStore';
import { computeAccountBalance, computeTotalBalance } from '@/utils/calculations';

describe('useFinoraStore integration', () => {
  beforeEach(() => {
    useFinoraStore.getState().resetDemoData();
  });

  it('adds, updates, and deletes transactions and updates dependent balances', () => {
    const store = useFinoraStore.getState();
    const initialBalance = computeTotalBalance(store.accounts, store.transactions);

    const created = store.addTransaction({
      title: 'Audit Test Income',
      amountPaise: 500000, // ₹5,000
      type: 'income',
      category: 'freelance',
      accountId: 'acc_main',
      date: new Date().toISOString().slice(0, 10),
    });

    let updated = useFinoraStore.getState();
    expect(computeTotalBalance(updated.accounts, updated.transactions)).toBe(
      initialBalance + 500000,
    );

    updated.updateTransaction(created.id, { amountPaise: 800000 });
    updated = useFinoraStore.getState();
    expect(computeTotalBalance(updated.accounts, updated.transactions)).toBe(
      initialBalance + 800000,
    );

    updated.deleteTransaction(created.id);
    updated = useFinoraStore.getState();
    expect(computeTotalBalance(updated.accounts, updated.transactions)).toBe(initialBalance);
  });

  it('rejects invalid transaction amounts and self-transfers at store boundary', () => {
    const store = useFinoraStore.getState();
    expect(() =>
      store.addTransaction({
        title: 'Bad',
        amountPaise: -100,
        type: 'expense',
        category: 'food',
        accountId: 'acc_main',
        date: '2026-11-27',
      }),
    ).toThrow();

    expect(() =>
      store.transferBetweenAccounts({
        fromAccountId: 'acc_main',
        toAccountId: 'acc_main',
        amountPaise: 10000,
        date: '2026-11-27',
      }),
    ).toThrow();
  });

  it('keeps total balance invariant during internal transfers', () => {
    const store = useFinoraStore.getState();
    const totalBefore = computeTotalBalance(store.accounts, store.transactions);
    const mainAcc = store.accounts.find((a) => a.id === 'acc_main')!;
    const savAcc = store.accounts.find((a) => a.id === 'acc_savings')!;
    const mainBefore = computeAccountBalance(mainAcc, store.transactions);
    const savBefore = computeAccountBalance(savAcc, store.transactions);

    store.transferBetweenAccounts({
      fromAccountId: 'acc_main',
      toAccountId: 'acc_savings',
      amountPaise: 250000,
      date: '2026-11-27',
    });

    const after = useFinoraStore.getState();
    expect(computeTotalBalance(after.accounts, after.transactions)).toBe(totalBefore);
    expect(computeAccountBalance(mainAcc, after.transactions)).toBe(mainBefore - 250000);
    expect(computeAccountBalance(savAcc, after.transactions)).toBe(savBefore + 250000);
  });

  it('records goal contributions and generates milestone notifications', () => {
    const store = useFinoraStore.getState();
    const goal = store.addGoal({
      title: 'Test Goal',
      targetPaise: 100000,
      currentPaise: 60000,
      deadline: '2027-03-01',
    });

    store.contributeToGoal(goal.id, 40000);
    const after = useFinoraStore.getState();
    const updatedGoal = after.goals.find((g) => g.id === goal.id)!;
    expect(updatedGoal.currentPaise).toBe(100000);
    expect(after.notifications[0]?.type).toBe('goal_milestone');
  });

  it('marks recurring payment as paid, logs expense, and advances next due date', () => {
    const store = useFinoraStore.getState();
    const rec = store.addRecurringPayment({
      title: 'Test Subscription',
      amountPaise: 49900,
      category: 'utilities',
      accountId: 'acc_main',
      frequency: 'monthly',
      nextPaymentDate: '2026-11-01',
      isActive: true,
    });

    const txCountBefore = useFinoraStore.getState().transactions.length;
    store.markRecurringPaid(rec.id);

    const after = useFinoraStore.getState();
    expect(after.transactions.length).toBe(txCountBefore + 1);
    const updatedRec = after.recurringPayments.find((r) => r.id === rec.id)!;
    expect(updatedRec.nextPaymentDate).toBe('2026-12-01');
  });
});
