import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFinoraStore } from '@/stores/useFinoraStore';
import type { NotificationType } from '@/types/finance';
import { formatDisplayDate } from '@/utils/dates';
import { isSafeInternalRoute } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

const FILTER_OPTIONS: Array<{ value: 'all' | NotificationType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'budget_exceeded', label: 'Budget Exceeded' },
  { value: 'budget_warning', label: 'Budget Warnings' },
  { value: 'recurring_upcoming', label: 'Recurring' },
  { value: 'goal_milestone', label: 'Goals' },
  { value: 'transaction_created', label: 'Transactions' },
];

export default function NotificationsPage() {
  const navigate = useNavigate();
  const notifications = useFinoraStore((s) => s.notifications);
  const preferences = useFinoraStore((s) => s.preferences);
  const markNotificationRead = useFinoraStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useFinoraStore((s) => s.markAllNotificationsRead);
  const deleteNotification = useFinoraStore((s) => s.deleteNotification);

  const [filter, setFilter] = useState<'all' | NotificationType>('all');

  const filtered = useMemo(
    () =>
      notifications.filter((n) => (filter === 'all' ? true : n.type === filter)),
    [notifications, filter],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[#18231E] dark:text-[#EDF2EE]">
            Notifications
          </h2>
          <p className="mt-0.5 text-sm text-[#66736A] dark:text-[#9EADA4]">
            {unreadCount > 0
              ? `You have ${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}.`
              : 'All caught up.'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0}
          onClick={() => {
            markAllNotificationsRead();
            toast.success('All notifications marked as read');
          }}
          leftIcon={<CheckCheck className="h-4 w-4" />}
        >
          Mark all as read
        </Button>
      </div>

      {/* Type Filter Pills */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              filter === opt.value
                ? 'bg-[#153D32] text-[#F7F8F5] dark:bg-[#2F765B]'
                : 'border border-[#E5E9E3] bg-white text-[#66736A] hover:text-[#18231E] dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#9EADA4]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="No notifications"
          description="Alerts for budget thresholds, goal milestones, and upcoming bills will appear here."
        />
      ) : (
        <Card>
          <CardContent className="divide-y divide-[#E5E9E3] p-0 dark:divide-[#24332C]">
            {filtered.map((n) => {
              const badgeVariant =
                n.type === 'budget_exceeded'
                  ? 'danger'
                  : n.type === 'budget_warning'
                    ? 'warning'
                    : n.type === 'goal_milestone'
                      ? 'gold'
                      : n.type === 'recurring_upcoming'
                        ? 'coral'
                        : 'success';

              return (
                <div
                  key={n.id}
                  className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
                    !n.read ? 'bg-[#E5EFE8]/35 dark:bg-[#1A3329]/35' : ''
                  }`}
                >
                  <div
                    className="space-y-1 cursor-pointer"
                    onClick={() => {
                      markNotificationRead(n.id);
                      if (isSafeInternalRoute(n.linkTo)) navigate(n.linkTo);
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {!n.read ? (
                        <span className="h-2 w-2 rounded-full bg-[#2F765B]" />
                      ) : null}
                      <span className="text-sm font-semibold text-[#18231E] dark:text-[#EDF2EE]">
                        {n.title}
                      </span>
                      <Badge variant={badgeVariant} className="capitalize">
                        {n.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#66736A] dark:text-[#9EADA4]">{n.message}</p>
                    <p className="text-[11px] text-[#929B94]">
                      {formatDisplayDate(n.createdAt.slice(0, 10), preferences.dateFormat)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {!n.read ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markNotificationRead(n.id)}
                        leftIcon={<Check className="h-3.5 w-3.5" />}
                      >
                        Mark read
                      </Button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => deleteNotification(n.id)}
                      aria-label="Delete notification"
                      className="rounded-lg p-1.5 text-[#66736A] hover:bg-[#FBEAEA] hover:text-[#D9534F] dark:text-[#9EADA4] cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
