import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/FormControls';
import { useFinoraStore } from '@/stores/useFinoraStore';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  getCategoryMeta,
} from '@/utils/categories';
import { fromPaise, MAX_AMOUNT_MAJOR, toPaise } from '@/utils/money';
import type { CategoryId } from '@/types/finance';

const transactionSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(80, 'Max 80 characters'),
    amount: z
      .number({ error: 'Enter a valid amount' })
      .finite('Enter a finite amount')
      .positive('Amount must be greater than zero')
      .max(MAX_AMOUNT_MAJOR, `Amount cannot exceed ${MAX_AMOUNT_MAJOR.toLocaleString()}`),
    type: z.enum(['income', 'expense', 'transfer']),
    category: z.string().min(1, 'Category is required'),
    accountId: z.string().min(1, 'Account is required'),
    toAccountId: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date'),
    notes: z.string().max(300, 'Max 300 characters').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'transfer') {
      if (!data.toAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select a destination account',
          path: ['toAccountId'],
        });
      } else if (data.toAccountId === data.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Destination must differ from source account',
          path: ['toAccountId'],
        });
      }
    }
  });

type TransactionFormValues = z.infer<typeof transactionSchema>;

export function TransactionDrawer() {
  const open = useFinoraStore((s) => s.isTransactionDrawerOpen);
  const editingId = useFinoraStore((s) => s.editingTransactionId);
  const closeDrawer = useFinoraStore((s) => s.closeTransactionDrawer);
  const transactions = useFinoraStore((s) => s.transactions);
  const accounts = useFinoraStore((s) => s.accounts);
  const addTransaction = useFinoraStore((s) => s.addTransaction);
  const updateTransaction = useFinoraStore((s) => s.updateTransaction);

  const editingTx = editingId
    ? transactions.find((t) => t.id === editingId) ?? null
    : null;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      title: '',
      amount: undefined as unknown as number,
      type: 'expense',
      category: 'food',
      accountId: accounts[0]?.id ?? '',
      toAccountId: accounts[1]?.id ?? '',
      date: new Date().toISOString().slice(0, 10),
      notes: '',
    },
  });

  const watchedType = watch('type');

  useEffect(() => {
    if (!open) return;
    if (editingTx) {
      reset({
        title: editingTx.title,
        amount: fromPaise(editingTx.amountPaise),
        type: editingTx.type,
        category: editingTx.category,
        accountId: editingTx.accountId,
        toAccountId: editingTx.toAccountId ?? '',
        date: editingTx.date,
        notes: editingTx.notes ?? '',
      });
    } else {
      reset({
        title: '',
        amount: undefined as unknown as number,
        type: 'expense',
        category: 'food',
        accountId: accounts[0]?.id ?? '',
        toAccountId: accounts[1]?.id ?? '',
        date: new Date().toISOString().slice(0, 10),
        notes: '',
      });
    }
  }, [open, editingTx, accounts, reset]);

  const handleTypeChange = (nextType: 'income' | 'expense' | 'transfer') => {
    setValue('type', nextType);
    if (nextType === 'income') {
      setValue('category', 'salary');
    } else if (nextType === 'expense') {
      setValue('category', 'food');
    } else {
      setValue('category', 'transfer');
    }
  };

  const onSubmit = (values: TransactionFormValues) => {
    const payload = {
      title: values.title,
      amountPaise: toPaise(values.amount),
      type: values.type,
      category: (values.type === 'transfer' ? 'transfer' : values.category) as CategoryId,
      accountId: values.accountId,
      toAccountId: values.type === 'transfer' ? values.toAccountId : undefined,
      date: values.date,
      notes: values.notes?.trim() || undefined,
    };

    try {
      if (editingTx) {
        updateTransaction(editingTx.id, payload);
        toast.success('Transaction updated');
      } else {
        addTransaction(payload);
        toast.success('Transaction added');
      }
      closeDrawer();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to save transaction');
    }
  };

  const categoryOptions =
    watchedType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Drawer
      open={open}
      onClose={closeDrawer}
      title={editingTx ? 'Edit Transaction' : 'Add Transaction'}
      description={
        editingTx
          ? 'Update transaction details. All balances and budgets recalculate automatically.'
          : 'Record an income, expense, or internal transfer.'
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-[#18231E] dark:text-[#EDF2EE]">
            Transaction Type
          </span>
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#EEF1EC] p-1 dark:bg-[#1C2722]">
            {(['expense', 'income', 'transfer'] as const).map((t) => {
              const active = watchedType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTypeChange(t)}
                  className={`rounded-md py-2 text-xs font-medium capitalize transition-colors cursor-pointer ${active
                    ? 'bg-white text-[#153D32] shadow-xs dark:bg-[#151E1A] dark:text-[#EDF2EE]'
                    : 'text-[#66736A] hover:text-[#18231E] dark:text-[#9EADA4]'
                    }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        <Input
          label="Title"
          placeholder="e.g., Grocery Shopping, Monthly Salary"
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
            placeholder="0.00"
            required
            error={errors.amount?.message}
            {...register('amount', { valueAsNumber: true })}
          />
          <Input
            label="Date"
            type="date"
            required
            error={errors.date?.message}
            {...register('date')}
          />
        </div>

        {watchedType !== 'transfer' ? (
          <Select
            label="Category"
            required
            error={errors.category?.message}
            {...register('category')}
          >
            {categoryOptions.map((catId) => (
              <option key={catId} value={catId}>
                {getCategoryMeta(catId).label}
              </option>
            ))}
          </Select>
        ) : null}

        <Select
          label={watchedType === 'transfer' ? 'From Account' : 'Account'}
          required
          error={errors.accountId?.message}
          {...register('accountId')}
        >
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </Select>

        {watchedType === 'transfer' ? (
          <Select
            label="To Account"
            required
            error={errors.toAccountId?.message}
            {...register('toAccountId')}
          >
            <option value="">Select destination...</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </Select>
        ) : null}

        <Textarea
          label="Notes"
          placeholder="Optional context or receipt reference"
          error={errors.notes?.message}
          {...register('notes')}
        />

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5E9E3] dark:border-[#24332C]">
          <Button variant="outline" onClick={closeDrawer}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {editingTx ? 'Save Changes' : 'Save Transaction'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
