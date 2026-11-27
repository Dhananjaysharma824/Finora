import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFinoraStore } from '@/stores/useFinoraStore';
import { computeBudgetStats } from '@/utils/calculations';
import { EXPENSE_CATEGORIES, getCategoryMeta } from '@/utils/categories';
import { getMonthLabel, getRecentMonthKeys } from '@/utils/dates';
import { formatMoney, fromPaise, MAX_AMOUNT_MAJOR, toPaise } from '@/utils/money';
import type { Budget, ExpenseCategoryId } from '@/types/finance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/FormControls';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';

const budgetSchema = z.object({
  category: z.string().min(1, 'Select a category'),
  limit: z
    .number({ error: 'Enter a valid limit' })
    .finite()
    .positive('Limit must be > 0')
    .max(MAX_AMOUNT_MAJOR),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Select a valid month'),
  description: z.string().max(160).optional(),
});

type BudgetFormValues = z.infer<typeof budgetSchema>;

export default function BudgetsPage() {
  const budgets = useFinoraStore((s) => s.budgets);
  const transactions = useFinoraStore((s) => s.transactions);
  const preferences = useFinoraStore((s) => s.preferences);
  const selectedMonth = useFinoraStore((s) => s.selectedMonth);
  const setSelectedMonth = useFinoraStore((s) => s.setSelectedMonth);
  const addBudget = useFinoraStore((s) => s.addBudget);
  const updateBudget = useFinoraStore((s) => s.updateBudget);
  const deleteBudget = useFinoraStore((s) => s.deleteBudget);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const monthOptions = useMemo(() => getRecentMonthKeys(6), []);

  const currentBudgets = useMemo(
    () =>
      computeBudgetStats(
        budgets.filter((b) => b.month === selectedMonth),
        transactions,
      ),
    [budgets, selectedMonth, transactions],
  );

  const totalLimit = currentBudgets.reduce((s, b) => s + b.limitPaise, 0);
  const totalSpent = currentBudgets.reduce((s, b) => s + b.spentPaise, 0);
  const totalRemaining = totalLimit - totalSpent;
  const overallUtil = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 1000) / 10 : 0;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
  });

  const openCreateModal = () => {
    setEditingBudget(null);
    reset({
      category: 'food',
      limit: 5000,
      month: selectedMonth,
      description: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (b: Budget) => {
    setEditingBudget(b);
    reset({
      category: b.category,
      limit: fromPaise(b.limitPaise),
      month: b.month,
      description: b.description ?? '',
    });
    setModalOpen(true);
  };

  const onSubmit = (values: BudgetFormValues) => {
    if (editingBudget) {
      updateBudget(editingBudget.id, {
        category: values.category as ExpenseCategoryId,
        limitPaise: toPaise(values.limit),
        month: values.month,
        description: values.description?.trim() || undefined,
      });
      toast.success('Budget updated');
    } else {
      addBudget({
        category: values.category as ExpenseCategoryId,
        limitPaise: toPaise(values.limit),
        month: values.month,
        description: values.description?.trim() || undefined,
      });
      toast.success('Budget created');
    }
    setModalOpen(false);
  };

  const fmt = (paise: number) =>
    formatMoney(paise, {
      currency: preferences.currency,
      numberFormat: preferences.numberFormat,
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[#18231E] dark:text-[#EDF2EE]">
            Budgets
          </h2>
          <p className="mt-0.5 text-sm text-[#66736A] dark:text-[#9EADA4]">
            Plan smarter. Spend with intention.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            aria-label="Budget month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 rounded-lg border border-[#E5E9E3] bg-white px-3 text-xs font-medium text-[#18231E] dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#EDF2EE] cursor-pointer"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {getMonthLabel(m)}
              </option>
            ))}
          </select>
          <Button onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />}>
            Create Budget
          </Button>
        </div>
      </div>

      {/* Overall Budget Summary */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-4 sm:items-center">
          <div>
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Monthly Limit</div>
            <div className="mt-1 font-display text-xl font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
              {fmt(totalLimit)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Spent So Far</div>
            <div className="mt-1 font-display text-xl font-semibold tabular-nums text-[#D97757]">
              {fmt(totalSpent)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Remaining</div>
            <div
              className={`mt-1 font-display text-xl font-semibold tabular-nums ${totalRemaining >= 0
                ? 'text-[#2F765B] dark:text-[#7FD1AE]'
                : 'text-[#D9534F]'
                }`}
            >
              {fmt(totalRemaining)}
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#66736A] dark:text-[#9EADA4]">Overall Utilization</span>
              <span className="font-semibold tabular-nums">{overallUtil}%</span>
            </div>
            <ProgressBar
              value={overallUtil}
              status={overallUtil >= 100 ? 'exceeded' : overallUtil >= 80 ? 'warning' : 'healthy'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Budget Cards Grid */}
      {currentBudgets.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="h-5 w-5" />}
          title={`No budgets for ${getMonthLabel(selectedMonth)}`}
          description="Set monthly category limits to monitor your spending in real time."
          action={
            <Button onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />}>
              Create Budget
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {currentBudgets.map((b) => {
            const cat = getCategoryMeta(b.category);
            return (
              <Card key={b.id} className="flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div>
                      <CardTitle>{cat.label}</CardTitle>
                      {b.description ? (
                        <CardDescription className="mt-0.5">{b.description}</CardDescription>
                      ) : null}
                    </div>
                  </div>
                  <Badge
                    variant={
                      b.status === 'exceeded'
                        ? 'danger'
                        : b.status === 'warning'
                          ? 'warning'
                          : 'success'
                    }
                  >
                    {b.status === 'exceeded'
                      ? 'Exceeded'
                      : b.status === 'warning'
                        ? 'Warning'
                        : 'Healthy'}
                  </Badge>
                </CardHeader>

                <CardContent className="space-y-4 pt-2">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="font-display text-xl font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
                        {fmt(b.spentPaise)}
                      </span>
                      <span className="ml-1.5 text-xs text-[#66736A] dark:text-[#9EADA4]">
                        of {fmt(b.limitPaise)}
                      </span>
                    </div>
                    <span className="text-xs font-semibold tabular-nums text-[#66736A] dark:text-[#9EADA4]">
                      {b.utilizationPct}%
                    </span>
                  </div>

                  <ProgressBar value={b.utilizationPct} status={b.status} />

                  <div className="flex items-center justify-between border-t border-[#E5E9E3] pt-3 text-xs dark:border-[#24332C]">
                    <span
                      className={
                        b.remainingPaise >= 0
                          ? 'text-[#2F765B] dark:text-[#7FD1AE] font-medium tabular-nums'
                          : 'text-[#D9534F] font-medium tabular-nums'
                      }
                    >
                      {b.remainingPaise >= 0
                        ? `${fmt(b.remainingPaise)} left`
                        : `${fmt(Math.abs(b.remainingPaise))} over`}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(b)}
                        aria-label={`Edit ${cat.label} budget`}
                        className="rounded-lg p-1.5 text-[#66736A] hover:bg-[#EEF1EC] hover:text-[#18231E] dark:text-[#9EADA4] dark:hover:bg-[#1C2722] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(b.id)}
                        aria-label={`Delete ${cat.label} budget`}
                        className="rounded-lg p-1.5 text-[#66736A] hover:bg-[#FBEAEA] hover:text-[#D9534F] dark:text-[#9EADA4] dark:hover:bg-[#361B1A] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Budget Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBudget ? 'Edit Budget' : 'Create Budget'}
        description="Set a monthly spending limit for a category."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Category"
            required
            error={errors.category?.message}
            {...register('category')}
          >
            {EXPENSE_CATEGORIES.map((catId) => (
              <option key={catId} value={catId}>
                {getCategoryMeta(catId).label}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monthly Limit"
              type="number"
              step="1"
              min="1"
              required
              error={errors.limit?.message}
              {...register('limit', { valueAsNumber: true })}
            />
            <Input
              label="Month"
              type="month"
              required
              error={errors.month?.message}
              {...register('month')}
            />
          </div>

          <Textarea
            label="Description (optional)"
            placeholder="What does this budget cover?"
            error={errors.description?.message}
            {...register('description')}
          />

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingBudget ? 'Save Changes' : 'Create Budget'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteBudget(deleteId);
            toast.success('Budget deleted');
          }
        }}
        title="Delete Budget"
        description="Remove this monthly category budget? Your transactions will remain untouched."
        confirmLabel="Delete"
      />
    </div>
  );
}
