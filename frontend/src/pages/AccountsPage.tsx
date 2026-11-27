import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeftRight, Banknote, Landmark, Pencil, Plus, Smartphone, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useFinoraStore } from '@/stores/useFinoraStore';
import { computeAccountBalance, computeTotalBalance } from '@/utils/calculations';
import { formatDisplayDate } from '@/utils/dates';
import { formatMoney, fromPaise, MAX_AMOUNT_MAJOR, toPaise } from '@/utils/money';
import type { Account, AccountType } from '@/types/finance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/FormControls';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

const accountSchema = z.object({
  name: z.string().trim().min(1, 'Account name is required').max(50),
  type: z.enum(['bank', 'savings', 'cash', 'wallet']),
  openingBalance: z.number({ error: 'Enter a valid amount' }).finite().min(-MAX_AMOUNT_MAJOR).max(MAX_AMOUNT_MAJOR),
  institution: z.string().max(40).optional(),
  lastFour: z.string().max(4).optional(),
  color: z.string().min(4),
});

type AccountFormValues = z.infer<typeof accountSchema>;

const transferSchema = z
  .object({
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
    amount: z.number({ error: 'Enter a valid amount' }).finite().positive('Amount must be > 0').max(MAX_AMOUNT_MAJOR),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().max(160).optional(),
  })
  .refine((d) => d.fromAccountId !== d.toAccountId, {
    message: 'Destination account must be different',
    path: ['toAccountId'],
  });

type TransferFormValues = z.infer<typeof transferSchema>;

const ACCOUNT_ICONS: Record<AccountType, React.ReactNode> = {
  bank: <Landmark className="h-4 w-4" />,
  savings: <Wallet className="h-4 w-4" />,
  cash: <Banknote className="h-4 w-4" />,
  wallet: <Smartphone className="h-4 w-4" />,
};

export default function AccountsPage() {
  const accounts = useFinoraStore((s) => s.accounts);
  const transactions = useFinoraStore((s) => s.transactions);
  const preferences = useFinoraStore((s) => s.preferences);
  const addAccount = useFinoraStore((s) => s.addAccount);
  const updateAccount = useFinoraStore((s) => s.updateAccount);
  const deleteAccount = useFinoraStore((s) => s.deleteAccount);
  const transferBetweenAccounts = useFinoraStore((s) => s.transferBetweenAccounts);

  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? '');
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
  });

  const transferForm = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
  });

  const totalBalance = useMemo(
    () => computeTotalBalance(accounts, transactions),
    [accounts, transactions],
  );

  const accountBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const acc of accounts) {
      map.set(acc.id, computeAccountBalance(acc, transactions));
    }
    return map;
  }, [accounts, transactions]);

  const selectedHistory = useMemo(
    () =>
      transactions
        .filter((t) => t.accountId === selectedAccountId || t.toAccountId === selectedAccountId)
        .slice(0, 12),
    [transactions, selectedAccountId],
  );

  const fmt = (paise: number) =>
    formatMoney(paise, {
      currency: preferences.currency,
      numberFormat: preferences.numberFormat,
    });

  const openCreateModal = () => {
    setEditingAccount(null);
    accountForm.reset({
      name: '',
      type: 'bank',
      openingBalance: 0,
      institution: '',
      lastFour: '',
      color: '#153D32',
    });
    setAccountModalOpen(true);
  };

  const openEditModal = (acc: Account) => {
    setEditingAccount(acc);
    accountForm.reset({
      name: acc.name,
      type: acc.type,
      openingBalance: fromPaise(acc.openingBalancePaise),
      institution: acc.institution ?? '',
      lastFour: acc.lastFour ?? '',
      color: acc.color,
    });
    setAccountModalOpen(true);
  };

  const openTransferModal = () => {
    transferForm.reset({
      fromAccountId: accounts[0]?.id ?? '',
      toAccountId: accounts[1]?.id ?? accounts[0]?.id ?? '',
      amount: 1000,
      date: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    setTransferModalOpen(true);
  };

  const handleSaveAccount = (values: AccountFormValues) => {
    const payload = {
      name: values.name,
      type: values.type,
      openingBalancePaise: toPaise(values.openingBalance),
      institution: values.institution?.trim() || undefined,
      lastFour: values.lastFour?.trim() || undefined,
      color: values.color,
    };
    if (editingAccount) {
      updateAccount(editingAccount.id, payload);
      toast.success('Account updated');
    } else {
      const created = addAccount(payload);
      setSelectedAccountId(created.id);
      toast.success('Account created');
    }
    setAccountModalOpen(false);
  };

  const handleTransfer = (values: TransferFormValues) => {
    transferBetweenAccounts({
      fromAccountId: values.fromAccountId,
      toAccountId: values.toAccountId,
      amountPaise: toPaise(values.amount),
      date: values.date,
      notes: values.notes?.trim() || undefined,
    });
    toast.success('Internal transfer recorded');
    setTransferModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[#18231E] dark:text-[#EDF2EE]">
            Accounts & Wallets
          </h2>
          <p className="mt-0.5 text-sm text-[#66736A] dark:text-[#9EADA4]">
            Combined net balance across all accounts: <strong className="tabular-nums text-[#153D32] dark:text-[#7FD1AE]">{fmt(totalBalance)}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={openTransferModal}
            disabled={accounts.length < 2}
            leftIcon={<ArrowLeftRight className="h-4 w-4" />}
          >
            Internal Transfer
          </Button>
          <Button onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />}>
            Add Account
          </Button>
        </div>
      </div>

      {/* Account Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {accounts.map((acc) => {
          const bal = accountBalances.get(acc.id) ?? acc.openingBalancePaise;
          const isSelected = acc.id === selectedAccountId;
          return (
            <Card
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id)}
              className={`cursor-pointer transition-colors ${isSelected
                ? 'border-[#2F765B] ring-2 ring-[#2F765B]/15 dark:border-[#3D9473]'
                : 'hover:border-[#929B94]'
                }`}
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: acc.color }}
                  >
                    {ACCOUNT_ICONS[acc.type]}
                  </span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openEditModal(acc)}
                      aria-label={`Edit ${acc.name}`}
                      className="rounded-lg p-1.5 text-[#66736A] hover:bg-[#EEF1EC] dark:text-[#9EADA4] dark:hover:bg-[#1C2722] cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {accounts.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setDeleteId(acc.id)}
                        aria-label={`Delete ${acc.name}`}
                        className="rounded-lg p-1.5 text-[#66736A] hover:bg-[#FBEAEA] hover:text-[#D9534F] dark:text-[#9EADA4] dark:hover:bg-[#361B1A] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-sm font-semibold text-[#18231E] dark:text-[#EDF2EE]">
                      {acc.name}
                    </h3>
                  </div>
                  <p className="mt-0.5 text-xs text-[#929B94] dark:text-[#6C7A72]">
                    {acc.institution || acc.type.toUpperCase()}
                    {acc.lastFour ? ` · •••• ${acc.lastFour}` : ''}
                  </p>
                </div>

                <div className="font-display text-xl font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
                  {fmt(bal)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Selected Account History */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>
              Account History — {accounts.find((a) => a.id === selectedAccountId)?.name ?? 'Account'}
            </CardTitle>
            <CardDescription>
              Recent credits, debits, and internal transfers (transfers do not count as income or expense)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {selectedHistory.length === 0 ? (
            <p className="py-6 text-center text-xs text-[#66736A] dark:text-[#9EADA4]">
              No transactions recorded for this account yet.
            </p>
          ) : (
            <div className="divide-y divide-[#E5E9E3] dark:divide-[#24332C]">
              {selectedHistory.map((tx) => {
                const isIncomingTransfer =
                  tx.type === 'transfer' && tx.toAccountId === selectedAccountId;
                const isPositive = tx.type === 'income' || isIncomingTransfer;
                return (
                  <div key={tx.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <div className="font-medium text-[#18231E] dark:text-[#EDF2EE]">
                        {tx.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-[#66736A] dark:text-[#9EADA4]">
                        <span>{formatDisplayDate(tx.date, preferences.dateFormat)}</span>
                        <Badge variant="neutral" className="capitalize">
                          {tx.type}
                        </Badge>
                      </div>
                    </div>
                    <span
                      className={`font-semibold tabular-nums ${isPositive
                        ? 'text-[#2F765B] dark:text-[#7FD1AE]'
                        : 'text-[#18231E] dark:text-[#EDF2EE]'
                        }`}
                    >
                      {isPositive ? '+' : '-'}
                      {fmt(tx.amountPaise)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Account Modal */}
      <Modal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        title={editingAccount ? 'Edit Account' : 'Add Account'}
      >
        <form onSubmit={accountForm.handleSubmit(handleSaveAccount)} className="space-y-4">
          <Input
            label="Account Name"
            placeholder="e.g., Main Bank Account"
            required
            error={accountForm.formState.errors.name?.message}
            {...accountForm.register('name')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Account Type" required {...accountForm.register('type')}>
              <option value="bank">Bank Account</option>
              <option value="savings">Savings Account</option>
              <option value="cash">Cash</option>
              <option value="wallet">Digital Wallet</option>
            </Select>
            <Input
              label="Opening Balance"
              type="number"
              step="0.01"
              required
              error={accountForm.formState.errors.openingBalance?.message}
              {...accountForm.register('openingBalance', { valueAsNumber: true })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Institution (optional)"
              placeholder="e.g., HDFC Bank"
              {...accountForm.register('institution')}
            />
            <Input
              label="Last 4 digits (optional)"
              placeholder="4829"
              maxLength={4}
              {...accountForm.register('lastFour')}
            />
          </div>
          <Select label="Accent Color" {...accountForm.register('color')}>
            <option value="#153D32">Forest Green</option>
            <option value="#2F765B">Emerald</option>
            <option value="#D8A85D">Gold</option>
            <option value="#D97757">Coral</option>
          </Select>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={() => setAccountModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">{editingAccount ? 'Save Changes' : 'Create Account'}</Button>
          </div>
        </form>
      </Modal>

      {/* Internal Transfer Modal */}
      <Modal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Simulated Internal Transfer"
        description="Move funds between your Finora accounts. Transfers never count as income or expenses."
      >
        <form onSubmit={transferForm.handleSubmit(handleTransfer)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="From Account" required {...transferForm.register('fromAccountId')}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select
              label="To Account"
              required
              error={transferForm.formState.errors.toAccountId?.message}
              {...transferForm.register('toAccountId')}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              error={transferForm.formState.errors.amount?.message}
              {...transferForm.register('amount', { valueAsNumber: true })}
            />
            <Input
              label="Date"
              type="date"
              required
              {...transferForm.register('date')}
            />
          </div>
          <Input
            label="Notes (optional)"
            placeholder="e.g., Monthly savings transfer"
            {...transferForm.register('notes')}
          />
          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={() => setTransferModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Record Transfer</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteAccount(deleteId);
            if (selectedAccountId === deleteId) {
              setSelectedAccountId(accounts.find((a) => a.id !== deleteId)?.id ?? '');
            }
            toast.success('Account deleted');
          }
        }}
        title="Delete Account"
        description="Are you sure you want to remove this account?"
        confirmLabel="Delete"
      />
    </div>
  );
}
