import { create } from 'zustand';
import type {
  Account,
  AppNotification,
  Budget,
  FinoraPersistedData,
  RecurringPayment,
  SavingsGoal,
  Transaction,
  UserPreferences,
  UserProfile,
} from '@/types/finance';
import { createDemoData } from '@/mocks/demoData';
import { CURRENT_SCHEMA_VERSION, localStorageRepository } from '@/services/storage';
import { generateId } from '@/lib/utils';
import { advanceRecurringDate } from '@/utils/dates';
import { getCategoryMeta } from '@/utils/categories';
import { formatMoney, isValidPaise, MAX_AMOUNT_PAISE } from '@/utils/money';
import { finoraApi, isBackendConfigured } from '@/services/api';

interface FinoraStore extends FinoraPersistedData {
  // UI & API transient state
  isTransactionDrawerOpen: boolean;
  editingTransactionId: string | null;
  isCommandPaletteOpen: boolean;
  selectedMonth: string;
  isHydrating: boolean;
  apiError: string | null;

  // UI actions
  openTransactionDrawer: (txId?: string | null) => void;
  closeTransactionDrawer: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSelectedMonth: (monthKey: string) => void;
  clearApiError: () => void;
  syncFromBackend: () => Promise<void>;

  // Transaction CRUD
  addTransaction: (
    input: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Transaction;
  updateTransaction: (
    id: string,
    updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>,
  ) => void;
  deleteTransaction: (id: string) => void;
  importTransactions: (
    items: Array<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>>,
  ) => number;

  // Account CRUD
  addAccount: (input: Omit<Account, 'id' | 'createdAt'>) => Account;
  updateAccount: (id: string, updates: Partial<Omit<Account, 'id' | 'createdAt'>>) => void;
  deleteAccount: (id: string) => void;
  transferBetweenAccounts: (params: {
    fromAccountId: string;
    toAccountId: string;
    amountPaise: number;
    date: string;
    notes?: string;
  }) => void;

  // Budget CRUD
  addBudget: (input: Omit<Budget, 'id' | 'createdAt'>) => Budget;
  updateBudget: (id: string, updates: Partial<Omit<Budget, 'id' | 'createdAt'>>) => void;
  deleteBudget: (id: string) => void;

  // Savings Goal CRUD
  addGoal: (input: Omit<SavingsGoal, 'id' | 'createdAt'>) => SavingsGoal;
  updateGoal: (id: string, updates: Partial<Omit<SavingsGoal, 'id' | 'createdAt'>>) => void;
  deleteGoal: (id: string) => void;
  contributeToGoal: (goalId: string, amountPaise: number, accountId?: string) => void;

  // Recurring Payment CRUD
  addRecurringPayment: (
    input: Omit<RecurringPayment, 'id' | 'createdAt'>,
  ) => RecurringPayment;
  updateRecurringPayment: (
    id: string,
    updates: Partial<Omit<RecurringPayment, 'id' | 'createdAt'>>,
  ) => void;
  deleteRecurringPayment: (id: string) => void;
  markRecurringPaid: (id: string) => void;

  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string) => void;

  // Profile & Preferences & Data Management
  updateProfile: (updates: Partial<UserProfile>) => void;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  resetDemoData: () => void;
  clearAllData: () => void;
}

function getInitialData(): FinoraPersistedData {
  const stored = localStorageRepository.load();
  if (stored) return stored;
  const demo = createDemoData();
  localStorageRepository.save(demo);
  return demo;
}

function persistState(state: FinoraStore) {
  const snapshot: FinoraPersistedData = {
    version: CURRENT_SCHEMA_VERSION,
    profile: state.profile,
    preferences: state.preferences,
    accounts: state.accounts,
    transactions: state.transactions,
    budgets: state.budgets,
    goals: state.goals,
    recurringPayments: state.recurringPayments,
    notifications: state.notifications,
  };
  localStorageRepository.save(snapshot);
}

const initialData = getInitialData();

export const useFinoraStore = create<FinoraStore>((set, get) => ({
  ...initialData,
  isTransactionDrawerOpen: false,
  editingTransactionId: null,
  isCommandPaletteOpen: false,
  selectedMonth: new Date().toISOString().slice(0, 7),
  isHydrating: false,
  apiError: null,

  openTransactionDrawer: (txId = null) =>
    set({ isTransactionDrawerOpen: true, editingTransactionId: txId }),
  closeTransactionDrawer: () =>
    set({ isTransactionDrawerOpen: false, editingTransactionId: null }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setSelectedMonth: (monthKey) => set({ selectedMonth: monthKey }),
  clearApiError: () => set({ apiError: null }),

  syncFromBackend: async () => {
    if (!isBackendConfigured()) return;
    set({ isHydrating: true, apiError: null });
    try {
      const [accRes, txRes, budRes, goalRes, recRes] = await Promise.all([
        finoraApi.accounts.list(),
        finoraApi.transactions.list(100),
        finoraApi.budgets.list(),
        finoraApi.goals.list(),
        finoraApi.recurring.list(),
      ]);
      set({
        accounts: accRes.accounts,
        transactions: txRes.items,
        budgets: budRes.budgets,
        goals: goalRes.goals,
        recurringPayments: recRes.items,
        isHydrating: false,
      });
    } catch (err) {
      set({
        isHydrating: false,
        apiError: err instanceof Error ? err.message : 'Failed to sync workspace',
      });
    }
  },

  addTransaction: (input) => {
    if (!isValidPaise(input.amountPaise)) {
      throw new RangeError('Transaction amount must be a positive integer within safe bounds');
    }
    const state = get();
    const accountExists = state.accounts.some((a) => a.id === input.accountId);
    if (!accountExists) {
      throw new Error('Selected account does not exist');
    }
    if (input.type === 'transfer') {
      const destExists = state.accounts.some((a) => a.id === input.toAccountId);
      if (!destExists || input.toAccountId === input.accountId) {
        throw new Error('Invalid destination account for transfer');
      }
    }

    const now = new Date().toISOString();
    const newTx: Transaction = {
      id: generateId('tx'),
      title: input.title.trim().slice(0, 100),
      amountPaise: input.amountPaise,
      type: input.type,
      category: input.type === 'transfer' ? 'transfer' : input.category,
      accountId: input.accountId,
      toAccountId: input.type === 'transfer' ? input.toAccountId : undefined,
      date: input.date,
      notes: input.notes?.trim().slice(0, 400) || undefined,
      recurringId: input.recurringId,
      goalId: input.goalId,
      createdAt: now,
      updatedAt: now,
    };

    const nextTransactions = [newTx, ...state.transactions].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    const nextNotifications = [...state.notifications];

    if (newTx.type === 'expense' && state.preferences.alerts.budgetAlerts) {
      const monthKey = newTx.date.slice(0, 7);
      const matchingBudget = state.budgets.find(
        (b) => b.category === newTx.category && b.month === monthKey,
      );
      if (matchingBudget) {
        const spent = nextTransactions
          .filter(
            (t) =>
              t.type === 'expense' &&
              t.category === newTx.category &&
              t.date.startsWith(monthKey),
          )
          .reduce((sum, t) => sum + t.amountPaise, 0);
        const pct = Math.round((spent / matchingBudget.limitPaise) * 100);
        const catLabel = getCategoryMeta(newTx.category).label;

        if (pct >= 100) {
          nextNotifications.unshift({
            id: generateId('notif'),
            type: 'budget_exceeded',
            title: `${catLabel} budget exceeded`,
            message: `${catLabel} spending is at ${pct}% of your monthly limit.`,
            read: false,
            createdAt: now,
            linkTo: '/budgets',
          });
        } else if (pct >= 80) {
          nextNotifications.unshift({
            id: generateId('notif'),
            type: 'budget_warning',
            title: `${catLabel} budget at ${pct}%`,
            message: `You've used ${pct}% of your ${catLabel} budget this month.`,
            read: false,
            createdAt: now,
            linkTo: '/budgets',
          });
        }
      }
    }

    set((prev) => {
      const updated = {
        ...prev,
        transactions: nextTransactions,
        notifications: nextNotifications.slice(0, 50),
      };
      persistState(updated);
      return updated;
    });

    if (isBackendConfigured()) {
      void finoraApi.transactions
        .create({
          title: newTx.title,
          amount: newTx.amountPaise / 100,
          type: newTx.type.toUpperCase(),
          currency: state.preferences.currency,
          accountId: newTx.accountId,
          toAccountId: newTx.toAccountId,
          categoryId: newTx.category,
          date: newTx.date,
          notes: newTx.notes,
        })
        .catch((err) => {
          set({ apiError: err instanceof Error ? err.message : 'Backend sync failed' });
        });
    }

    return newTx;
  },

  updateTransaction: (id, updates) => {
    if (updates.amountPaise !== undefined && !isValidPaise(updates.amountPaise)) {
      throw new RangeError('Transaction amount must be a positive integer within safe bounds');
    }
    const now = new Date().toISOString();
    set((prev) => {
      const nextTransactions = prev.transactions
        .map((tx) => {
          if (tx.id !== id) return tx;
          const nextType = updates.type ?? tx.type;
          const nextAccountId = updates.accountId ?? tx.accountId;
          const nextToAccountId =
            nextType === 'transfer' ? updates.toAccountId ?? tx.toAccountId : undefined;
          if (nextType === 'transfer' && (!nextToAccountId || nextToAccountId === nextAccountId)) {
            return tx;
          }
          return {
            ...tx,
            title: updates.title !== undefined ? updates.title.trim().slice(0, 100) : tx.title,
            amountPaise: updates.amountPaise ?? tx.amountPaise,
            type: nextType,
            category: nextType === 'transfer' ? 'transfer' : updates.category ?? tx.category,
            accountId: nextAccountId,
            toAccountId: nextToAccountId,
            date: updates.date ?? tx.date,
            notes: updates.notes !== undefined ? updates.notes.trim().slice(0, 400) || undefined : tx.notes,
            updatedAt: now,
          };
        })
        .sort((a, b) => b.date.localeCompare(a.date));
      const updated = { ...prev, transactions: nextTransactions };
      persistState(updated);
      return updated;
    });
  },

  deleteTransaction: (id) => {
    set((prev) => {
      const nextTransactions = prev.transactions.filter((tx) => tx.id !== id);
      const updated = { ...prev, transactions: nextTransactions };
      persistState(updated);
      return updated;
    });
    if (isBackendConfigured()) {
      void finoraApi.transactions.remove(id).catch((err) => {
        set({ apiError: err instanceof Error ? err.message : 'Failed to delete on server' });
      });
    }
  },

  importTransactions: (items) => {
    const state = get();
    const validAccountIds = new Set(state.accounts.map((a) => a.id));
    const fallbackAccountId = state.accounts[0]?.id;
    if (!fallbackAccountId) return 0;

    const now = new Date().toISOString();
    const created: Transaction[] = items
      .filter((item) => item.title.trim().length > 0 && isValidPaise(item.amountPaise))
      .map((item) => ({
        id: generateId('tx'),
        title: item.title.trim().slice(0, 100),
        amountPaise: item.amountPaise,
        type: item.type,
        category: item.type === 'transfer' ? 'transfer' : item.category,
        accountId: validAccountIds.has(item.accountId) ? item.accountId : fallbackAccountId,
        date: item.date,
        notes: item.notes?.trim().slice(0, 400) || undefined,
        createdAt: now,
        updatedAt: now,
      }));

    if (created.length === 0) return 0;

    set((prev) => {
      const nextTransactions = [...created, ...prev.transactions].sort((a, b) =>
        b.date.localeCompare(a.date),
      );
      const updated = { ...prev, transactions: nextTransactions };
      persistState(updated);
      return updated;
    });
    return created.length;
  },

  addAccount: (input) => {
    if (
      !Number.isSafeInteger(input.openingBalancePaise) ||
      Math.abs(input.openingBalancePaise) > MAX_AMOUNT_PAISE
    ) {
      throw new RangeError('Opening balance exceeds safe bounds');
    }
    const now = new Date().toISOString();
    const account: Account = {
      id: generateId('acc'),
      name: input.name.trim().slice(0, 60),
      type: input.type,
      openingBalancePaise: input.openingBalancePaise,
      institution: input.institution?.trim().slice(0, 60) || undefined,
      lastFour: input.lastFour?.trim().slice(0, 4) || undefined,
      color: input.color,
      createdAt: now,
    };
    set((prev) => {
      const updated = { ...prev, accounts: [...prev.accounts, account] };
      persistState(updated);
      return updated;
    });
    return account;
  },

  updateAccount: (id, updates) => {
    if (
      updates.openingBalancePaise !== undefined &&
      (!Number.isSafeInteger(updates.openingBalancePaise) ||
        Math.abs(updates.openingBalancePaise) > MAX_AMOUNT_PAISE)
    ) {
      throw new RangeError('Opening balance exceeds safe bounds');
    }
    set((prev) => {
      const updated = {
        ...prev,
        accounts: prev.accounts.map((a) =>
          a.id === id
            ? {
                ...a,
                name: updates.name !== undefined ? updates.name.trim().slice(0, 60) : a.name,
                type: updates.type ?? a.type,
                openingBalancePaise: updates.openingBalancePaise ?? a.openingBalancePaise,
                institution:
                  updates.institution !== undefined
                    ? updates.institution.trim().slice(0, 60) || undefined
                    : a.institution,
                lastFour:
                  updates.lastFour !== undefined
                    ? updates.lastFour.trim().slice(0, 4) || undefined
                    : a.lastFour,
                color: updates.color ?? a.color,
              }
            : a,
        ),
      };
      persistState(updated);
      return updated;
    });
  },

  deleteAccount: (id) => {
    set((prev) => {
      if (prev.accounts.length <= 1) return prev;
      const updated = {
        ...prev,
        accounts: prev.accounts.filter((a) => a.id !== id),
      };
      persistState(updated);
      return updated;
    });
  },

  transferBetweenAccounts: ({ fromAccountId, toAccountId, amountPaise, date, notes }) => {
    if (!isValidPaise(amountPaise)) {
      throw new RangeError('Transfer amount must be positive and within safe bounds');
    }
    if (fromAccountId === toAccountId) {
      throw new Error('Source and destination accounts must differ');
    }
    const state = get();
    const fromAcc = state.accounts.find((a) => a.id === fromAccountId);
    const toAcc = state.accounts.find((a) => a.id === toAccountId);
    if (!fromAcc || !toAcc) {
      throw new Error('Invalid source or destination account');
    }
    const title = `Transfer: ${fromAcc.name} → ${toAcc.name}`;
    state.addTransaction({
      title,
      amountPaise,
      type: 'transfer',
      category: 'transfer',
      accountId: fromAccountId,
      toAccountId,
      date,
      notes,
    });
  },

  addBudget: (input) => {
    if (!isValidPaise(input.limitPaise)) {
      throw new RangeError('Budget limit must be positive and within safe bounds');
    }
    const budget: Budget = {
      id: generateId('bud'),
      category: input.category,
      limitPaise: input.limitPaise,
      month: input.month,
      description: input.description?.trim().slice(0, 200) || undefined,
      createdAt: new Date().toISOString(),
    };
    set((prev) => {
      const updated = { ...prev, budgets: [...prev.budgets, budget] };
      persistState(updated);
      return updated;
    });
    return budget;
  },

  updateBudget: (id, updates) => {
    if (updates.limitPaise !== undefined && !isValidPaise(updates.limitPaise)) {
      throw new RangeError('Budget limit must be positive and within safe bounds');
    }
    set((prev) => {
      const updated = {
        ...prev,
        budgets: prev.budgets.map((b) =>
          b.id === id
            ? {
                ...b,
                category: updates.category ?? b.category,
                limitPaise: updates.limitPaise ?? b.limitPaise,
                month: updates.month ?? b.month,
                description:
                  updates.description !== undefined
                    ? updates.description.trim().slice(0, 200) || undefined
                    : b.description,
              }
            : b,
        ),
      };
      persistState(updated);
      return updated;
    });
  },

  deleteBudget: (id) => {
    set((prev) => {
      const updated = {
        ...prev,
        budgets: prev.budgets.filter((b) => b.id !== id),
      };
      persistState(updated);
      return updated;
    });
  },

  addGoal: (input) => {
    if (!isValidPaise(input.targetPaise) || !isValidPaise(input.currentPaise, true)) {
      throw new RangeError('Goal amounts must be within safe bounds');
    }
    const goal: SavingsGoal = {
      id: generateId('goal'),
      title: input.title.trim().slice(0, 80),
      targetPaise: input.targetPaise,
      currentPaise: input.currentPaise,
      deadline: input.deadline,
      accountId: input.accountId,
      notes: input.notes?.trim().slice(0, 240) || undefined,
      createdAt: new Date().toISOString(),
    };
    set((prev) => {
      const updated = { ...prev, goals: [...prev.goals, goal] };
      persistState(updated);
      return updated;
    });
    return goal;
  },

  updateGoal: (id, updates) => {
    if (updates.targetPaise !== undefined && !isValidPaise(updates.targetPaise)) {
      throw new RangeError('Target amount must be positive and within safe bounds');
    }
    if (updates.currentPaise !== undefined && !isValidPaise(updates.currentPaise, true)) {
      throw new RangeError('Current savings must be non-negative and within safe bounds');
    }
    set((prev) => {
      const updated = {
        ...prev,
        goals: prev.goals.map((g) =>
          g.id === id
            ? {
                ...g,
                title: updates.title !== undefined ? updates.title.trim().slice(0, 80) : g.title,
                targetPaise: updates.targetPaise ?? g.targetPaise,
                currentPaise: updates.currentPaise ?? g.currentPaise,
                deadline: updates.deadline ?? g.deadline,
                accountId: updates.accountId !== undefined ? updates.accountId : g.accountId,
                notes:
                  updates.notes !== undefined
                    ? updates.notes.trim().slice(0, 240) || undefined
                    : g.notes,
              }
            : g,
        ),
      };
      persistState(updated);
      return updated;
    });
  },

  deleteGoal: (id) => {
    set((prev) => {
      const updated = {
        ...prev,
        goals: prev.goals.filter((g) => g.id !== id),
      };
      persistState(updated);
      return updated;
    });
  },

  contributeToGoal: (goalId, amountPaise, accountId) => {
    if (!isValidPaise(amountPaise)) {
      throw new RangeError('Contribution amount must be positive and within safe bounds');
    }
    const state = get();
    const goal = state.goals.find((g) => g.id === goalId);
    if (!goal) return;

    const nextCurrent = Math.min(goal.currentPaise + amountPaise, MAX_AMOUNT_PAISE);
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const prevPct = goal.targetPaise > 0 ? (goal.currentPaise / goal.targetPaise) * 100 : 0;
    const nextPct = goal.targetPaise > 0 ? (nextCurrent / goal.targetPaise) * 100 : 0;

    let nextTransactions = state.transactions;
    const targetAccountId = goal.accountId ?? state.accounts.find((a) => a.type === 'savings')?.id;
    if (
      accountId &&
      targetAccountId &&
      accountId !== targetAccountId &&
      state.accounts.some((a) => a.id === accountId) &&
      state.accounts.some((a) => a.id === targetAccountId)
    ) {
      const tx: Transaction = {
        id: generateId('tx'),
        title: `Goal Contribution: ${goal.title}`,
        amountPaise,
        type: 'transfer',
        category: 'transfer',
        accountId,
        toAccountId: targetAccountId,
        date: today,
        goalId: goal.id,
        notes: `Contribution toward ${goal.title}`,
        createdAt: now,
        updatedAt: now,
      };
      nextTransactions = [tx, ...nextTransactions];
    }

    const nextNotifications = [...state.notifications];
    if (state.preferences.alerts.savingsMilestones) {
      if (prevPct < 100 && nextPct >= 100) {
        nextNotifications.unshift({
          id: generateId('notif'),
          type: 'goal_milestone',
          title: `Goal achieved: ${goal.title}`,
          message: `You reached 100% of your ${formatMoney(goal.targetPaise, { currency: state.preferences.currency })} target.`,
          read: false,
          createdAt: now,
          linkTo: '/goals',
        });
      } else if (prevPct < 75 && nextPct >= 75) {
        nextNotifications.unshift({
          id: generateId('notif'),
          type: 'goal_milestone',
          title: `${goal.title} crossed 75%`,
          message: `You're making steady progress toward ${goal.title}.`,
          read: false,
          createdAt: now,
          linkTo: '/goals',
        });
      }
    }

    set((prev) => {
      const updated = {
        ...prev,
        goals: prev.goals.map((g) =>
          g.id === goalId ? { ...g, currentPaise: nextCurrent } : g,
        ),
        transactions: nextTransactions,
        notifications: nextNotifications.slice(0, 50),
      };
      persistState(updated);
      return updated;
    });
  },

  addRecurringPayment: (input) => {
    if (!isValidPaise(input.amountPaise)) {
      throw new RangeError('Recurring payment amount must be positive and within safe bounds');
    }
    const payment: RecurringPayment = {
      id: generateId('rec'),
      title: input.title.trim().slice(0, 80),
      amountPaise: input.amountPaise,
      category: input.category,
      accountId: input.accountId,
      frequency: input.frequency,
      nextPaymentDate: input.nextPaymentDate,
      isActive: input.isActive,
      notes: input.notes?.trim().slice(0, 240) || undefined,
      createdAt: new Date().toISOString(),
    };
    set((prev) => {
      const updated = {
        ...prev,
        recurringPayments: [...prev.recurringPayments, payment],
      };
      persistState(updated);
      return updated;
    });
    return payment;
  },

  updateRecurringPayment: (id, updates) => {
    if (updates.amountPaise !== undefined && !isValidPaise(updates.amountPaise)) {
      throw new RangeError('Recurring payment amount must be positive and within safe bounds');
    }
    set((prev) => {
      const updated = {
        ...prev,
        recurringPayments: prev.recurringPayments.map((r) =>
          r.id === id
            ? {
                ...r,
                title: updates.title !== undefined ? updates.title.trim().slice(0, 80) : r.title,
                amountPaise: updates.amountPaise ?? r.amountPaise,
                category: updates.category ?? r.category,
                accountId: updates.accountId ?? r.accountId,
                frequency: updates.frequency ?? r.frequency,
                nextPaymentDate: updates.nextPaymentDate ?? r.nextPaymentDate,
                isActive: updates.isActive ?? r.isActive,
                lastPaidDate: updates.lastPaidDate ?? r.lastPaidDate,
                notes:
                  updates.notes !== undefined
                    ? updates.notes.trim().slice(0, 240) || undefined
                    : r.notes,
              }
            : r,
        ),
      };
      persistState(updated);
      return updated;
    });
  },

  deleteRecurringPayment: (id) => {
    set((prev) => {
      const updated = {
        ...prev,
        recurringPayments: prev.recurringPayments.filter((r) => r.id !== id),
      };
      persistState(updated);
      return updated;
    });
  },

  markRecurringPaid: (id) => {
    const state = get();
    const item = state.recurringPayments.find((r) => r.id === id);
    if (!item) return;

    const today = new Date().toISOString().slice(0, 10);
    state.addTransaction({
      title: item.title,
      amountPaise: item.amountPaise,
      type: 'expense',
      category: item.category,
      accountId: item.accountId,
      date: today,
      recurringId: item.id,
      notes: `Recorded from recurring reminder (${item.frequency})`,
    });

    const nextDate = advanceRecurringDate(item.nextPaymentDate, item.frequency);
    state.updateRecurringPayment(id, {
      lastPaidDate: today,
      nextPaymentDate: nextDate,
    });
  },

  markNotificationRead: (id) => {
    set((prev) => {
      const updated = {
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n,
        ),
      };
      persistState(updated);
      return updated;
    });
  },

  markAllNotificationsRead: () => {
    set((prev) => {
      const updated = {
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, read: true })),
      };
      persistState(updated);
      return updated;
    });
  },

  deleteNotification: (id) => {
    set((prev) => {
      const updated = {
        ...prev,
        notifications: prev.notifications.filter((n) => n.id !== id),
      };
      persistState(updated);
      return updated;
    });
  },

  updateProfile: (updates) => {
    set((prev) => {
      const updated = {
        ...prev,
        profile: {
          name: updates.name !== undefined ? updates.name.trim().slice(0, 80) : prev.profile.name,
          email: updates.email !== undefined ? updates.email.trim().slice(0, 120) : prev.profile.email,
          role: updates.role !== undefined ? updates.role.trim().slice(0, 80) : prev.profile.role,
          avatarUrl: updates.avatarUrl ?? prev.profile.avatarUrl,
        },
      };
      persistState(updated);
      return updated;
    });
    if (isBackendConfigured() && updates.name !== undefined) {
      void finoraApi.users.updateProfile({ name: updates.name.trim() }).catch((err) => {
        set({ apiError: err instanceof Error ? err.message : 'Failed to save profile' });
      });
    }
  },

  updatePreferences: (updates) => {
    set((prev) => {
      const updated = {
        ...prev,
        preferences: {
          ...prev.preferences,
          ...updates,
          alerts: {
            ...prev.preferences.alerts,
            ...(updates.alerts ?? {}),
          },
        },
      };
      persistState(updated);
      return updated;
    });
    if (isBackendConfigured()) {
      void finoraApi.users
        .updatePreferences({
          ...(updates.currency ? { currency: updates.currency } : {}),
          ...(updates.dateFormat ? { dateFormat: updates.dateFormat } : {}),
          ...(updates.numberFormat ? { numberFormat: updates.numberFormat } : {}),
          ...(updates.theme ? { theme: updates.theme } : {}),
        })
        .catch((err) => {
          set({ apiError: err instanceof Error ? err.message : 'Failed to save preferences' });
        });
    }
  },

  resetDemoData: () => {
    const demo = createDemoData();
    set((prev) => {
      const updated = {
        ...prev,
        ...demo,
        selectedMonth: new Date().toISOString().slice(0, 7),
      };
      persistState(updated);
      return updated;
    });
  },

  clearAllData: () => {
    localStorageRepository.clear();
    const empty: FinoraPersistedData = {
      version: CURRENT_SCHEMA_VERSION,
      profile: {
        name: 'Alex Sharma',
        email: 'alex.sharma@finora.app',
        role: 'Personal Finance',
      },
      preferences: get().preferences,
      accounts: [
        {
          id: 'acc_default',
          name: 'Primary Account',
          type: 'bank',
          openingBalancePaise: 0,
          color: '#153D32',
          createdAt: new Date().toISOString(),
        },
      ],
      transactions: [],
      budgets: [],
      goals: [],
      recurringPayments: [],
      notifications: [],
    };
    set((prev) => {
      const updated = { ...prev, ...empty };
      persistState(updated);
      return updated;
    });
  },
}));

export const selectUnreadNotificationCount = (state: { notifications: AppNotification[] }) =>
  state.notifications.filter((n) => !n.read).length;
