import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, startOfMonth, startOfWeek, startOfYear, subMonths, endOfMonth } from 'date-fns';
import { useFinoraStore } from '@/stores/useFinoraStore';
import {
  computeCategoryBreakdown,
  computeMonthlyCashFlow,
  computePeriodSummary,
  filterTransactionsByRange,
} from '@/utils/calculations';
import { formatMoney } from '@/utils/money';
import { getRecentMonthKeys } from '@/utils/dates';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { BarChart3 } from 'lucide-react';

type RangePreset = 'this_week' | 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'custom';

export default function AnalyticsPage() {
  const transactions = useFinoraStore((s) => s.transactions);
  const preferences = useFinoraStore((s) => s.preferences);

  const [preset, setPreset] = useState<RangePreset>('last_3_months');
  const [customStart, setCustomStart] = useState(
    format(subMonths(new Date(), 2), 'yyyy-MM-01'),
  );
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { start, end } = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case 'this_week':
        return {
          start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd'),
        };
      case 'this_month':
        return {
          start: format(startOfMonth(now), 'yyyy-MM-dd'),
          end: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
      case 'last_month': {
        const last = subMonths(now, 1);
        return {
          start: format(startOfMonth(last), 'yyyy-MM-dd'),
          end: format(endOfMonth(last), 'yyyy-MM-dd'),
        };
      }
      case 'last_3_months':
        return {
          start: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'),
          end: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
      case 'this_year':
        return {
          start: format(startOfYear(now), 'yyyy-MM-dd'),
          end: format(now, 'yyyy-MM-dd'),
        };
      case 'custom':
        return { start: customStart, end: customEnd };
    }
  }, [preset, customStart, customEnd]);

  const rangedTransactions = useMemo(
    () => filterTransactionsByRange(transactions, start, end),
    [transactions, start, end],
  );

  const summary = useMemo(
    () => computePeriodSummary(rangedTransactions),
    [rangedTransactions],
  );

  const expenseBreakdown = useMemo(
    () => computeCategoryBreakdown(rangedTransactions, 'expense'),
    [rangedTransactions],
  );

  const monthlySeries = useMemo(
    () => computeMonthlyCashFlow(transactions, getRecentMonthKeys(6)),
    [transactions],
  );

  const fmt = (paise: number, showSign = false) =>
    formatMoney(paise, {
      currency: preferences.currency,
      numberFormat: preferences.numberFormat,
      showSign,
    });

  const highestCategory = expenseBreakdown[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[#18231E] dark:text-[#EDF2EE]">
            Financial Analytics
          </h2>
          <p className="mt-0.5 text-sm text-[#66736A] dark:text-[#9EADA4]">
            Understand your financial patterns and make informed decisions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['this_week', 'This week'],
              ['this_month', 'This month'],
              ['last_month', 'Last month'],
              ['last_3_months', 'Last 3 months'],
              ['this_year', 'This year'],
              ['custom', 'Custom'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                preset === key
                  ? 'bg-[#153D32] text-[#F7F8F5] dark:bg-[#2F765B]'
                  : 'border border-[#E5E9E3] bg-white text-[#66736A] hover:text-[#18231E] dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#9EADA4]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {preset === 'custom' ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-xs font-medium text-[#66736A] dark:text-[#9EADA4]">
              Custom range:
            </span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E9E3] bg-white px-3 text-xs dark:border-[#24332C] dark:bg-[#151E1A]"
            />
            <span className="text-xs text-[#929B94]">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E9E3] bg-white px-3 text-xs dark:border-[#24332C] dark:bg-[#151E1A]"
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-medium text-[#66736A] dark:text-[#9EADA4]">
              Net Cash Flow
            </div>
            <div
              className={`mt-2 font-display text-2xl font-semibold tabular-nums ${
                summary.netCashFlowPaise >= 0
                  ? 'text-[#2F765B] dark:text-[#7FD1AE]'
                  : 'text-[#D9534F]'
              }`}
            >
              {fmt(summary.netCashFlowPaise, true)}
            </div>
            <div className="mt-1.5 text-xs text-[#929B94]">
              {summary.transactionCount} transactions in range
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-medium text-[#66736A] dark:text-[#9EADA4]">
              Period Income
            </div>
            <div className="mt-2 font-display text-2xl font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
              {fmt(summary.incomePaise)}
            </div>
            <div className="mt-1.5 text-xs text-[#2F765B] dark:text-[#7FD1AE]">
              Savings rate: {summary.savingsRate}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-medium text-[#66736A] dark:text-[#9EADA4]">
              Period Expenses
            </div>
            <div className="mt-2 font-display text-2xl font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
              {fmt(summary.expensePaise)}
            </div>
            <div className="mt-1.5 text-xs text-[#929B94]">
              Across {expenseBreakdown.length} categories
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-medium text-[#66736A] dark:text-[#9EADA4]">
              Top Expense Category
            </div>
            <div className="mt-2 font-display text-xl font-semibold text-[#18231E] dark:text-[#EDF2EE]">
              {highestCategory ? highestCategory.label : '—'}
            </div>
            <div className="mt-1.5 text-xs tabular-nums text-[#D97757]">
              {highestCategory
                ? `${fmt(highestCategory.amountPaise)} (${highestCategory.percentage}%)`
                : 'No expenses recorded'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Income vs Expenses Monthly Comparison */}
        <Card className="lg:col-span-7">
          <CardHeader>
            <div>
              <CardTitle>Income vs Expenses</CardTitle>
              <CardDescription>6-month side-by-side comparison</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="h-[280px] w-full"
              role="img"
              aria-label="Income versus expenses monthly comparison bar chart"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E9E3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#929B94' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#929B94' }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={(v: number) =>
                      formatMoney(Math.round(v * 100), {
                        currency: preferences.currency,
                        numberFormat: preferences.numberFormat,
                        compact: true,
                      })
                    }
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-lg border border-[#E5E9E3] bg-white px-3.5 py-2.5 text-xs shadow-lg dark:border-[#24332C] dark:bg-[#151E1A]">
                          <div className="mb-1 font-semibold text-[#18231E] dark:text-[#EDF2EE]">
                            {label}
                          </div>
                          {payload.map((entry) => (
                            <div key={entry.name} className="flex justify-between gap-4 tabular-nums">
                              <span className="capitalize text-[#66736A] dark:text-[#9EADA4]">
                                {entry.name}
                              </span>
                              <span className="font-semibold text-[#18231E] dark:text-[#EDF2EE]">
                                {fmt(Math.round(Number(entry.value) * 100))}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="income" fill="#153D32" radius={[6, 6, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="expenses" fill="#D97757" radius={[6, 6, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Spending Distribution Donut */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <div>
              <CardTitle>Spending Distribution</CardTitle>
              <CardDescription>Selected period breakdown</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="h-5 w-5" />}
                title="No expense data"
                description="No expenses recorded in the selected date range."
                className="py-10"
              />
            ) : (
              <div className="space-y-4">
                <div
                  className="h-[190px] w-full"
                  role="img"
                  aria-label="Spending distribution by category donut chart"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        dataKey="amountPaise"
                        nameKey="label"
                        innerRadius={50}
                        outerRadius={78}
                        paddingAngle={2}
                      >
                        {expenseBreakdown.map((item) => (
                          <Cell key={item.category} fill={item.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val) => fmt(Number(val ?? 0))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5">
                  {expenseBreakdown.map((item) => (
                    <div
                      key={item.category}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="flex items-center gap-2 text-[#18231E] dark:text-[#EDF2EE]">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                      </span>
                      <span className="tabular-nums text-[#66736A] dark:text-[#9EADA4]">
                        {fmt(item.amountPaise)} ({item.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Net Cash Flow & Monthly Spending Trend */}
        <Card className="lg:col-span-12">
          <CardHeader>
            <div>
              <CardTitle>Monthly Spending & Net Cash Flow Trend</CardTitle>
              <CardDescription>Track how your net surplus and expenses evolve over time</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Badge variant="success">Net Cash Flow</Badge>
              <Badge variant="coral">Expenses</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div
              className="h-[240px] w-full"
              role="img"
              aria-label="Monthly spending and net cash flow trend line chart"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E9E3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#929B94' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#929B94' }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                    tickFormatter={(v: number) =>
                      formatMoney(Math.round(v * 100), {
                        currency: preferences.currency,
                        numberFormat: preferences.numberFormat,
                        compact: true,
                      })
                    }
                  />
                  <Tooltip
                    formatter={(val) => fmt(Math.round(Number(val ?? 0) * 100))}
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="Net Cash Flow"
                    stroke="#2F765B"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#2F765B' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expenses"
                    name="Expenses"
                    stroke="#D97757"
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: '#D97757' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
