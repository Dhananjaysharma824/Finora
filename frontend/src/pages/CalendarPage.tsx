import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import { useFinoraStore } from '@/stores/useFinoraStore';
import { formatMoney } from '@/utils/money';
import { formatDisplayDate } from '@/utils/dates';
import { getCategoryMeta } from '@/utils/categories';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CalendarPage() {
  const transactions = useFinoraStore((s) => s.transactions);
  const recurringPayments = useFinoraStore((s) => s.recurringPayments);
  const preferences = useFinoraStore((s) => s.preferences);
  const openTransactionDrawer = useFinoraStore((s) => s.openTransactionDrawer);

  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDateIso, setSelectedDateIso] = useState<string>(() =>
    format(new Date(), 'yyyy-MM-dd'),
  );

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const txByDate = useMemo(() => {
    const map = new Map<
      string,
      { incomePaise: number; expensePaise: number; items: typeof transactions }
    >();
    for (const tx of transactions) {
      const entry = map.get(tx.date) ?? { incomePaise: 0, expensePaise: 0, items: [] };
      if (tx.type === 'income') entry.incomePaise += tx.amountPaise;
      if (tx.type === 'expense') entry.expensePaise += tx.amountPaise;
      entry.items.push(tx);
      map.set(tx.date, entry);
    }
    return map;
  }, [transactions]);

  const recurringByDate = useMemo(() => {
    const map = new Map<string, typeof recurringPayments>();
    for (const r of recurringPayments) {
      if (!r.isActive) continue;
      const list = map.get(r.nextPaymentDate) ?? [];
      list.push(r);
      map.set(r.nextPaymentDate, list);
    }
    return map;
  }, [recurringPayments]);

  const selectedDayTxs = txByDate.get(selectedDateIso)?.items ?? [];
  const selectedDayRecurring = recurringByDate.get(selectedDateIso) ?? [];

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
            Financial Calendar
          </h2>
          <p className="mt-0.5 text-sm text-[#66736A] dark:text-[#9EADA4]">
            Inspect daily cash flow, transactions, and upcoming recurring bills.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth((d) => subMonths(d, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[140px] text-center font-display text-sm font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentMonth((d) => addMonths(d, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Calendar Grid */}
        <Card className="lg:col-span-8">
          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-[#929B94] pb-2">
              {WEEKDAYS.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {calendarDays.map((day) => {
                const iso = format(day, 'yyyy-MM-dd');
                const inMonth = isSameMonth(day, currentMonth);
                const selected = iso === selectedDateIso;
                const dayData = txByDate.get(iso);
                const dayRecurring = recurringByDate.get(iso);
                const net = (dayData?.incomePaise ?? 0) - (dayData?.expensePaise ?? 0);

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDateIso(iso)}
                    className={`flex min-h-[58px] sm:min-h-[78px] flex-col justify-between rounded-lg border p-1.5 sm:p-2 text-left transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#153D32] bg-[#E5EFE8]/60 dark:border-[#3D9473] dark:bg-[#1A3329]'
                        : 'border-[#E5E9E3] bg-white hover:bg-[#F7F8F5] dark:border-[#24332C] dark:bg-[#151E1A] dark:hover:bg-[#1C2722]'
                    } ${!inMonth ? 'opacity-40' : ''}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          isToday(day)
                            ? 'flex h-5 w-5 items-center justify-center rounded-full bg-[#153D32] text-white dark:bg-[#2F765B]'
                            : 'text-[#18231E] dark:text-[#EDF2EE]'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {dayData && dayData.incomePaise > 0 ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#2F765B]" />
                        ) : null}
                        {dayData && dayData.expensePaise > 0 ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#D97757]" />
                        ) : null}
                        {dayRecurring && dayRecurring.length > 0 ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#D8A85D]" />
                        ) : null}
                      </div>
                    </div>

                    {dayData && (dayData.incomePaise > 0 || dayData.expensePaise > 0) ? (
                      <div
                        className={`hidden sm:block truncate text-[10px] font-semibold tabular-nums ${
                          net >= 0
                            ? 'text-[#2F765B] dark:text-[#7FD1AE]'
                            : 'text-[#D97757]'
                        }`}
                      >
                        {formatMoney(net, {
                          currency: preferences.currency,
                          numberFormat: preferences.numberFormat,
                          compact: true,
                          showSign: true,
                        })}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[#66736A] dark:text-[#9EADA4]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#2F765B]" /> Income
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#D97757]" /> Expense
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#D8A85D]" /> Upcoming Recurring
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Selected Date Activity */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <div>
              <CardTitle>{formatDisplayDate(selectedDateIso, preferences.dateFormat)}</CardTitle>
              <CardDescription>
                {selectedDayTxs.length} transactions · {selectedDayRecurring.length} reminders
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedDayRecurring.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-medium text-[#929B94]">
                  Scheduled reminders
                </div>
                {selectedDayRecurring.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-[#E5E9E3] bg-[#FAF3E6]/60 px-3 py-2 text-xs dark:border-[#24332C] dark:bg-[#332917]/40"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <Repeat className="h-3.5 w-3.5 text-[#D8A85D]" />
                      {r.title}
                    </span>
                    <span className="font-semibold tabular-nums">{fmt(r.amountPaise)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {selectedDayTxs.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#66736A] dark:text-[#9EADA4]">
                No transactions on this date.
              </p>
            ) : (
              <div className="divide-y divide-[#E5E9E3] dark:divide-[#24332C]">
                {selectedDayTxs.map((tx) => {
                  const cat = getCategoryMeta(tx.category);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => openTransactionDrawer(tx.id)}
                      className="flex items-center justify-between py-2.5 cursor-pointer hover:opacity-80"
                    >
                      <div>
                        <div className="text-sm font-medium text-[#18231E] dark:text-[#EDF2EE]">
                          {tx.title}
                        </div>
                        <Badge dotColor={cat.color} className="mt-1">
                          {cat.label}
                        </Badge>
                      </div>
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          tx.type === 'income'
                            ? 'text-[#2F765B] dark:text-[#7FD1AE]'
                            : 'text-[#18231E] dark:text-[#EDF2EE]'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {fmt(tx.amountPaise)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
