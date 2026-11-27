import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFinoraStore } from '@/stores/useFinoraStore';
import { computeGoalProgress } from '@/utils/calculations';
import { formatDisplayDate } from '@/utils/dates';
import { formatMoney, fromPaise, MAX_AMOUNT_MAJOR, toPaise } from '@/utils/money';
import type { SavingsGoal } from '@/types/finance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/FormControls';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';

const goalSchema = z.object({
  title: z.string().trim().min(1, 'Goal title is required').max(60),
  target: z.number({ error: 'Enter a valid target' }).finite().positive('Target must be > 0').max(MAX_AMOUNT_MAJOR),
  current: z.number({ error: 'Enter a valid amount' }).finite().min(0, 'Cannot be negative').max(MAX_AMOUNT_MAJOR),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid deadline'),
  accountId: z.string().optional(),
  notes: z.string().max(200).optional(),
});

type GoalFormValues = z.infer<typeof goalSchema>;

const contributeSchema = z.object({
  amount: z.number({ error: 'Enter a valid amount' }).finite().positive('Amount must be > 0').max(MAX_AMOUNT_MAJOR),
  accountId: z.string().optional(),
});

type ContributeFormValues = z.infer<typeof contributeSchema>;

export default function GoalsPage() {
  const goals = useFinoraStore((s) => s.goals);
  const accounts = useFinoraStore((s) => s.accounts);
  const preferences = useFinoraStore((s) => s.preferences);
  const addGoal = useFinoraStore((s) => s.addGoal);
  const updateGoal = useFinoraStore((s) => s.updateGoal);
  const deleteGoal = useFinoraStore((s) => s.deleteGoal);
  const contributeToGoal = useFinoraStore((s) => s.contributeToGoal);

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [contributingGoal, setContributingGoal] = useState<SavingsGoal | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const goalForm = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
  });

  const contributeForm = useForm<ContributeFormValues>({
    resolver: zodResolver(contributeSchema),
  });

  const openCreateModal = () => {
    setEditingGoal(null);
    goalForm.reset({
      title: '',
      target: 50000,
      current: 0,
      deadline: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      accountId: accounts.find((a) => a.type === 'savings')?.id ?? accounts[0]?.id ?? '',
      notes: '',
    });
    setGoalModalOpen(true);
  };

  const openEditModal = (g: SavingsGoal) => {
    setEditingGoal(g);
    goalForm.reset({
      title: g.title,
      target: fromPaise(g.targetPaise),
      current: fromPaise(g.currentPaise),
      deadline: g.deadline,
      accountId: g.accountId ?? '',
      notes: g.notes ?? '',
    });
    setGoalModalOpen(true);
  };

  const openContributeModal = (g: SavingsGoal) => {
    setContributingGoal(g);
    contributeForm.reset({
      amount: 2500,
      accountId: accounts[0]?.id ?? '',
    });
  };

  const handleSaveGoal = (values: GoalFormValues) => {
    const payload = {
      title: values.title,
      targetPaise: toPaise(values.target),
      currentPaise: toPaise(values.current),
      deadline: values.deadline,
      accountId: values.accountId || undefined,
      notes: values.notes?.trim() || undefined,
    };

    if (editingGoal) {
      updateGoal(editingGoal.id, payload);
      toast.success('Savings goal updated');
    } else {
      addGoal(payload);
      toast.success('Savings goal created');
    }
    setGoalModalOpen(false);
  };

  const handleContribute = (values: ContributeFormValues) => {
    if (!contributingGoal) return;
    contributeToGoal(
      contributingGoal.id,
      toPaise(values.amount),
      values.accountId || undefined,
    );
    toast.success(`Added contribution to ${contributingGoal.title}`);
    setContributingGoal(null);
  };

  const fmt = (paise: number) =>
    formatMoney(paise, {
      currency: preferences.currency,
      numberFormat: preferences.numberFormat,
    });

  const totalTarget = goals.reduce((s, g) => s + g.targetPaise, 0);
  const totalSaved = goals.reduce((s, g) => s + g.currentPaise, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[#18231E] dark:text-[#EDF2EE]">
            Your Savings Goals
          </h2>
          <p className="mt-0.5 text-sm text-[#66736A] dark:text-[#9EADA4]">
            Small steps today. Bigger possibilities tomorrow.
          </p>
        </div>
        <Button onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />}>
          New Savings Goal
        </Button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Total Saved</div>
            <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-[#2F765B] dark:text-[#7FD1AE]">
              {fmt(totalSaved)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Total Target</div>
            <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
              {fmt(totalTarget)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Active Goals</div>
            <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
              {goals.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="h-5 w-5" />}
          title="No savings goals yet"
          description="Create a goal for an emergency fund, laptop, trip, or milestone."
          action={
            <Button onClick={openCreateModal} leftIcon={<Plus className="h-4 w-4" />}>
              Create Goal
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {goals.map((goal) => {
            const { progressPct, remainingPaise, isCompleted } = computeGoalProgress(goal);
            return (
              <Card key={goal.id} className="flex flex-col justify-between">
                <CardHeader>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle>{goal.title}</CardTitle>
                      {isCompleted ? (
                        <Badge variant="success">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </Badge>
                      ) : (
                        <Badge variant="gold">{progressPct}%</Badge>
                      )}
                    </div>
                    {goal.notes ? (
                      <CardDescription className="mt-1">{goal.notes}</CardDescription>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(goal)}
                      aria-label={`Edit ${goal.title}`}
                      className="rounded-lg p-1.5 text-[#66736A] hover:bg-[#EEF1EC] dark:text-[#9EADA4] dark:hover:bg-[#1C2722] cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(goal.id)}
                      aria-label={`Delete ${goal.title}`}
                      className="rounded-lg p-1.5 text-[#66736A] hover:bg-[#FBEAEA] hover:text-[#D9534F] dark:text-[#9EADA4] dark:hover:bg-[#361B1A] cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="font-display text-2xl font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
                        {fmt(goal.currentPaise)}
                      </span>
                      <span className="ml-1.5 text-xs text-[#66736A] dark:text-[#9EADA4]">
                        / {fmt(goal.targetPaise)}
                      </span>
                    </div>
                    <span className="text-xs text-[#929B94] dark:text-[#6C7A72]">
                      Due {formatDisplayDate(goal.deadline, preferences.dateFormat)}
                    </span>
                  </div>

                  <ProgressBar
                    value={progressPct}
                    status={isCompleted ? 'healthy' : 'gold'}
                    heightClass="h-2.5"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs tabular-nums text-[#66736A] dark:text-[#9EADA4]">
                      {isCompleted
                        ? 'Target reached'
                        : `${fmt(remainingPaise)} remaining`}
                    </span>
                    <Button
                      size="sm"
                      variant={isCompleted ? 'secondary' : 'primary'}
                      onClick={() => openContributeModal(goal)}
                    >
                      Add Contribution
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Goal Modal */}
      <Modal
        open={goalModalOpen}
        onClose={() => setGoalModalOpen(false)}
        title={editingGoal ? 'Edit Savings Goal' : 'Create Savings Goal'}
      >
        <form onSubmit={goalForm.handleSubmit(handleSaveGoal)} className="space-y-4">
          <Input
            label="Goal Name"
            placeholder="e.g., Emergency Fund"
            required
            error={goalForm.formState.errors.title?.message}
            {...goalForm.register('title')}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Target Amount"
              type="number"
              step="1"
              min="1"
              required
              error={goalForm.formState.errors.target?.message}
              {...goalForm.register('target', { valueAsNumber: true })}
            />
            <Input
              label="Current Savings"
              type="number"
              step="1"
              min="0"
              required
              error={goalForm.formState.errors.current?.message}
              {...goalForm.register('current', { valueAsNumber: true })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Target Deadline"
              type="date"
              required
              error={goalForm.formState.errors.deadline?.message}
              {...goalForm.register('deadline')}
            />
            <Select label="Linked Account" {...goalForm.register('accountId')}>
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <Textarea
            label="Notes"
            placeholder="Optional milestone notes"
            {...goalForm.register('notes')}
          />
          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={() => setGoalModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {editingGoal ? 'Save Changes' : 'Create Goal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Contribute Modal */}
      <Modal
        open={Boolean(contributingGoal)}
        onClose={() => setContributingGoal(null)}
        title={`Contribute to ${contributingGoal?.title ?? ''}`}
        description="Adding a contribution updates your goal progress and records an internal transfer if funded from another account."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={contributeForm.handleSubmit(handleContribute)} className="space-y-4">
          <Input
            label="Contribution Amount"
            type="number"
            step="1"
            min="1"
            required
            error={contributeForm.formState.errors.amount?.message}
            {...contributeForm.register('amount', { valueAsNumber: true })}
          />
          <Select label="Source Account" {...contributeForm.register('accountId')}>
            <option value="">Direct balance update (no transfer)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="outline" onClick={() => setContributingGoal(null)}>
              Cancel
            </Button>
            <Button type="submit">Add Contribution</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) {
            deleteGoal(deleteId);
            toast.success('Savings goal deleted');
          }
        }}
        title="Delete Savings Goal"
        description="Are you sure you want to delete this savings goal?"
        confirmLabel="Delete"
      />
    </div>
  );
}
