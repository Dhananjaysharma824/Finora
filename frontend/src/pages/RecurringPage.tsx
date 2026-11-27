import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Info, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFinoraStore } from '@/stores/useFinoraStore';
import { computeRecurringTotals } from '@/utils/calculations';
import { EXPENSE_CATEGORIES, getCategoryMeta } from '@/utils/categories';
import { formatDisplayDate } from '@/utils/dates';
import { formatMoney, fromPaise, MAX_AMOUNT_MAJOR, toPaise } from '@/utils/money';
import type { ExpenseCategoryId, RecurringFrequency, RecurringPayment } from '@/types/finance';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/FormControls';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';

const recurringSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(60),
  amount: z.number({ error: 'Enter a valid amount' }).finite().positive('Amount must be > 0').max(MAX_AMOUNT_MAJOR),
  category: z.string().min(1),
  accountId: z.string().min(1),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  nextPaymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date'),
  isActive: z.boolean(),
  notes: z.string().max(200).optional(),
});

type RecurringFormValues = z.infer<typeof recurringSchema>;

export default function RecurringPage() {
  const recurringPayments = useFinoraStore((s) => s.recurringPayments);
  const accounts = useFinoraStore((s) => s.accounts);
  const preferences = useFinoraStore((s) => s.preferences);
  const addRecurringPayment = useFinoraStore((s) => s.addRecurringPayment);
  const updateRecurringPayment = useFinoraStore((s) => s.updateRecurringPayment);
  const deleteRecurringPayment = useFinoraStore((s) => s.deleteRecurringPayment);
  const markRecurringPaid = useFinoraStore((s) => s.markRecurringPaid);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RecurringPayment | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const totals = useMemo(
    () => computeRecurringTotals(recurringPayments),
    [recurringPayments],
  );

  const sortedPayments = useMemo(
    () => [...recurringPayments].sort((a, b) => a.nextPaymentDate.localeCompare(b.nextPaymentDate)),
    [recurringPayments],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringSchema),
  });

  const openCreateModal = () => {
    setEditingItem(null);
    reset({
      title: '',
      amount: 999,
      category: 'utilities',
      accountId: accounts[0]?.id ?? '',
      frequency: 'monthly',
      nextPaymentDate: new Date().toISOString().slice(0, 10),
      isActive: true,
      notes: '',
    });
    setModalOpen(true);
  };

  const openEditModal = (item: RecurringPayment) => {
    setEditingItem(item);
    reset({
      title: item.title,
      amount: fromPaise(item.amountPaise),
      category: item.category,
      accountId: item.accountId,
      frequency: item.frequency,
      nextPaymentDate: item.nextPaymentDate,
      isActive: item.isActive,
      notes: item.notes ?? '',
    });
    setModalOpen(true);
  };

  const onSubmit = (values: RecurringFormValues) => {
    const payload = {
      title: values.title,
      amountPaise: toPaise(values.amount),
      category: values.category as ExpenseCategoryId,
      accountId: values.accountId,
      frequency: values.frequency as RecurringFrequency,
      nextPaymentDate: values.nextPaymentDate,
      isActive: values.isActive,
      notes: values.notes?.trim() || undefined,
    };
    if (editingItem) {
      updateRecurringPayment(editingItem.id, payload);
      toast.success('Recurring payment updated');
    } else {
      addRecurringPayment(payload);
      toast.success('Recurring reminder added');
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
            Recurring Payments
          </h2>
          <p className="mt-0.5 text-sm text-[#66736A] dark:text-[#9EADA4]">
            Track subscriptions, bills, and scheduled payment reminders.
          </p>
        </div>
        <Button onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />}>
          Add Recurring Payment
        </Button>
      </div>

      {/* Disclaimer Banner */}
      <div className="flex items-start gap-2.5 rounded-lg border border-[#E5E9E3] bg-[#EEF1EC]/70 px-4 py-3 text-xs text-[#66736A] dark:border-[#24332C] dark:bg-[#1C2722] dark:text-[#9EADA4]">
        <Info className="h-4 w-4 shrink-0 text-[#2F765B] mt-0.5" />
        <span>
          Recurring payments in Finora act as reminders and local records. Finora does not automatically debit bank accounts.
        </span>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Monthly Recurring Total</div>
            <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
              {fmt(totals.monthlyTotalPaise)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Annualized Commitment</div>
            <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
              {fmt(totals.annualTotalPaise)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Active Reminders</div>
            <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-[#2F765B] dark:text-[#7FD1AE]">
              {totals.activeCount} of {recurringPayments.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {sortedPayments.length === 0 ? (
        <EmptyState
          icon={<Repeat className="h-5 w-5" />}
          title="No recurring payments"
          description="Add rent, internet, utilities, or subscriptions to keep track of due dates."
          action={
            <Button onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />}>
              Add Recurring Payment
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedPayments.map((item) => {
            const cat = getCategoryMeta(item.category);
            const acc = accountMap.get(item.accountId);
            return (
              <Card key={item.id} className={!item.isActive ? 'opacity-65' : ''}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-[#18231E] dark:text-[#EDF2EE]">
                          {item.title}
                        </h3>
                        <Badge variant={item.isActive ? 'success' : 'neutral'}>
                          {item.isActive ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-[#66736A] dark:text-[#9EADA4]">
                        <span className="capitalize">{item.frequency}</span>
                        <span>·</span>
                        <span>{cat.label}</span>
                      </div>
                    </div>
                    <div className="font-display text-lg font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
                      {fmt(item.amountPaise)}
                    </div>
                  </div>

                  <div className="rounded-lg bg-[#F7F8F5] px-3.5 py-2.5 text-xs space-y-1 dark:bg-[#1C2722]">
                    <div className="flex justify-between">
                      <span className="text-[#66736A] dark:text-[#9EADA4]">Next due</span>
                      <span className="font-medium tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
                        {formatDisplayDate(item.nextPaymentDate, preferences.dateFormat)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#66736A] dark:text-[#9EADA4]">Account</span>
                      <span className="text-[#18231E] dark:text-[#EDF2EE]">
                        {acc?.name ?? 'Account'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        markRecurringPaid(item.id);
                        toast.success(`Logged ${item.title} and advanced next due date`);
                      }}
                      leftIcon={<Check className="h-3.5 w-3.5" />}
                    >
                      Mark Paid
                    </Button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        aria-label={`Edit ${item.title}`}
                        className="rounded-lg p-1.5 text-[#66736A] hover:bg-[#EEF1EC] dark:text-[#9EADA4] dark:hover:bg-[#1C2722] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(item.id)}
                        aria-label={`Delete ${item.title}`}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Recurring Payment' : 'Add Recurring Payment'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g., Rent, Internet, Netflix"
            required
            error={errors.title?.message}
            {...register('title')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              error={errors.amount?.message}
              {...register('amount', { valueAsNumber: true })}
            />
            <Select label="Frequency" required {...register('frequency')}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" required {...register('category')}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {getCategoryMeta(c).label}
                </option>
              ))}
            </Select>
            <Select label="Account" required {...register('accountId')}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Next Payment Date"
            type="date"
            required
            error={errors.nextPaymentDate?.message}
            {...register('nextPaymentDate')}
          />
          <label className="flex items-center gap-2 text-xs font-medium text-[#18231E] dark:text-[#EDF2EE] cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded accent-[#153D32]"
              {...register('isActive')}
            />
            Active reminder
          </label>
          <Textarea label="Notes" {...register('notes')} />
          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingItem ? 'Save Changes' : 'Save Reminder'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteRecurringPayment(deleteId);
            toast.success('Recurring payment deleted');
          }
        }}
        title="Delete Recurring Payment"
        description="Remove this recurring payment reminder? Past recorded transactions will not be affected."
        confirmLabel="Delete"
      />
    </div>
  );
}
