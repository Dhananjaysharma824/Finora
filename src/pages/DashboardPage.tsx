import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Plus,
  Search,
  Wallet,
} from 'lucide-react';
import { useFinoraStore } from '@/stores/useFinoraStore';
import {
  computeBudgetStats,
  computeCategoryBreakdown,
  computeDailyCashFlow,
  computeGoalProgress,
  computeMonthlyCashFlow,
  computeMonthlyKpis,
  filterTransactionsByMonth,
} from '@/utils/calculations';
import { formatMoney } from '@/utils/money';
import { formatDisplayDate, getMonthLabel, getRecentMonthKeys } from '@/utils/dates';
import { getCategoryMeta } from '@/utils/categories';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';

export default function DashboardPage() {
  const navigate = useNavigate();
  const profile = useFinoraStore((s) => s.profile);
  const preferences = useFinoraStore((s) => s.preferences);
  const accounts = useFinoraStore((s) => s.accounts);
  const transactions = useFinoraStore((s) => s.transactions);
  const budgets = useFinoraStore((s) => s.budgets);
  const goals = useFinoraStore((s) => s.goals);
  const selectedMonth = useFinoraStore((s) => s.selectedMonth);
  const setSelectedMonth = useFinoraStore((s) => s.setSelectedMonth);
  const openTransactionDrawer = useFinoraStore((s) => s.openTransactionDrawer);

  const [cashFlowMode, setCashFlowMode] = useState<'daily' | 'monthly'>('daily');
  const [recentQuery, setRecentQuery] = useState('');

  const monthOptions = useMemo(() => getRecentMonthKeys(6), []);
  const firstName = profile.name.split(' ')[0] || 'Alex';

  const kpis = useMemo(
    () => computeMonthlyKpis(accounts, transactions, selectedMonth),
    [accounts, transactions, selectedMonth],
  );

  const monthTransactions = useMemo(
    () => filterTransactionsByMonth(transactions, selectedMonth),
    [transactions, selectedMonth],
  );

  const cashFlowData = useMemo(() => {
    if (cashFlowMode === 'daily') {
      return computeDailyCashFlow(transactions, selectedMonth);
    }
    return computeMonthlyCashFlow(transactions, monthOptions);
  }, [cashFlowMode, transactions, selectedMonth, monthOptions]);

  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(monthTransactions, 'expense'),
    [monthTransactions],
  );

  const monthBudgets = useMemo(
    () =>
      computeBudgetStats(
        budgets.filter((b) => b.month === selectedMonth),
        transactions,
      ),
    [budgets, selectedMonth, transactions],
  );

  const totalBudgetLimit = monthBudgets.reduce((s, b) => s + b.limitPaise, 0);
  const totalBudgetSpent = monthBudgets.reduce((s, b) => s + b.spentPaise, 0);
  const totalBudgetRemaining = totalBudgetLimit - totalBudgetSpent;

  const recentTransactions = useMemo(() => {
    const q = recentQuery.trim().toLowerCase();
    return transactions
      .filter((t) =>
        !q
          ? true
          : t.title.toLowerCase().includes(q) ||
            getCategoryMeta(t.category).label.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [transactions, recentQuery]);

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const fmt = (paise: number, showSign = false) =>
    formatMoney(paise, {
      currency: preferences.currency,
      numberFormat: preferences.numberFormat,
      showSign,
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-[#66736A] dark:text-[#9EADA4]">
            {formatDisplayDate(new Date().toISOString().slice(0, 10), preferences.dateFormat)}
          </p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] text-[#18231E] sm:text-[26px] dark:text-[#EDF2EE]">
            {getMonthLabel(selectedMonth)}
          </h2>
          <p className="mt-0.5 text-sm text-[#66736A] dark:text-[#9EADA4]">
            Financial summary for {firstName}&apos;s accounts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex items-center">
            <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-[#66736A]" />
            <select
              aria-label="Select month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E9E3] bg-white pl-9 pr-3 text-xs font-medium text-[#18231E] focus:border-[#2F765B] focus:outline-none dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#EDF2EE] cursor-pointer"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {getMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => openTransactionDrawer(null)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Transaction
          </Button>
        </div>
      </div>

      {/* 4 KPI Sections — Numbers, comparisons, and clear hierarchy */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Primary KPI: Total Balance in Forest Green */}
        <Card className="border-[#102F27] bg-[#153D32] text-[#F7F8F5] dark:border-[#1E4E40] dark:bg-[#102F27]">
          <CardContent className="p-5">
            <span className="text-xs font-medium text-[#B8D3C7]">Total Balance</span>
            <div className="mt-2 font-display text-2xl font-semibold tracking-tight tabular-nums sm:text-[26px]">
              {fmt(kpis.totalBalancePaise)}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-[#B8D3C7]">
              <span>Across {accounts.length} accounts</span>
              <Link
                to="/accounts"
                className="inline-flex items-center gap-1 font-medium text-[#D8A85D] hover:underline"
              >
                Manage <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Total Income */}
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-medium text-[#66736A] dark:text-[#9EADA4]">
              Total Income
            </span>
            <div className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#18231E] tabular-nums dark:text-[#EDF2EE]">
              {fmt(kpis.current.incomePaise)}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              {kpis.incomeChangePct !== null ? (
                <Badge variant={kpis.incomeChangePct >= 0 ? 'success' : 'coral'}>
                  {kpis.incomeChangePct >= 0 ? '+' : ''}
                  {kpis.incomeChangePct}%
                </Badge>
              ) : (
                <Badge variant="neutral">New</Badge>
              )}
              <span className="text-[#929B94] dark:text-[#6C7A72]">
                vs {fmt(kpis.previous.incomePaise)} last month
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Expenses */}
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-medium text-[#66736A] dark:text-[#9EADA4]">
              Total Expenses
            </span>
            <div className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#18231E] tabular-nums dark:text-[#EDF2EE]">
              {fmt(kpis.current.expensePaise)}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              {kpis.expenseChangePct !== null ? (
                <Badge variant={kpis.expenseChangePct <= 0 ? 'success' : 'coral'}>
                  {kpis.expenseChangePct >= 0 ? '+' : ''}
                  {kpis.expenseChangePct}%
                </Badge>
              ) : (
                <Badge variant="neutral">New</Badge>
              )}
              <span className="text-[#929B94] dark:text-[#6C7A72]">
                vs {fmt(kpis.previous.expensePaise)} last month
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Savings Rate */}
        <Card>
          <CardContent className="p-5">
            <span className="text-xs font-medium text-[#66736A] dark:text-[#9EADA4]">
              Savings Rate
            </span>
            <div className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#18231E] tabular-nums dark:text-[#EDF2EE]">
              {kpis.current.savingsRate}%
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs">
              <Badge variant={kpis.savingsRateDelta >= 0 ? 'success' : 'warning'}>
                {kpis.savingsRateDelta >= 0 ? '+' : ''}
                {kpis.savingsRateDelta} pts
              </Badge>
              <span className="text-[#929B94] dark:text-[#6C7A72]">
                Net {fmt(kpis.current.netCashFlowPaise, true)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Row: Cash Flow (8 cols) + Expense Breakdown (4 cols) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-8">
          <CardHeader className="flex-col sm:flex-row sm:items-center">
            <div>
              <CardTitle>Cash Flow</CardTitle>
              <CardDescription>
                Income vs. expenses{' '}
                {cashFlowMode === 'daily'
                  ? `for ${getMonthLabel(selectedMonth)}`
                  : 'over the last 6 months'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-[#EEF1EC] p-1 dark:bg-[#1C2722]">
              <button
                type="button"
                onClick={() => setCashFlowMode('daily')}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  cashFlowMode === 'daily'
                    ? 'bg-white text-[#153D32] shadow-xs dark:bg-[#151E1A] dark:text-[#EDF2EE]'
                    : 'text-[#66736A] hover:text-[#18231E] dark:text-[#9EADA4]'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setCashFlowMode('monthly')}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  cashFlowMode === 'monthly'
                    ? 'bg-white text-[#153D32] shadow-xs dark:bg-[#151E1A] dark:text-[#EDF2EE]'
                    : 'text-[#66736A] hover:text-[#18231E] dark:text-[#9EADA4]'
                }`}
              >
                6 Months
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex items-center gap-5 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2F765B]" />
                <span className="text-[#66736A] dark:text-[#9EADA4]">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#D97757]" />
                <span className="text-[#66736A] dark:text-[#9EADA4]">Expenses</span>
              </div>
            </div>
            <div
              className="h-[270px] w-full"
              role="img"
              aria-label={`Cash flow chart showing income and expenses for ${
                cashFlowMode === 'daily' ? getMonthLabel(selectedMonth) : 'the last 6 months'
              }`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="finoraIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2F765B" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#2F765B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="finoraExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D97757" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#D97757" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E9E3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#929B94' }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={20}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#929B94' }}
                    axisLine={false}
                    tickLine={false}
                    width={58}
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
                        <div className="rounded-lg border border-[#E5E9E3] bg-white px-3.5 py-2.5 shadow-lg dark:border-[#24332C] dark:bg-[#151E1A]">
                          <p className="mb-1.5 text-xs font-semibold text-[#18231E] dark:text-[#EDF2EE]">
                            {label}
                          </p>
                          {payload.map((entry) => (
                            <div
                              key={entry.name}
                              className="flex items-center justify-between gap-4 text-xs tabular-nums"
                            >
                              <span className="flex items-center gap-1.5 text-[#66736A] dark:text-[#9EADA4]">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                {entry.name === 'income' ? 'Income' : 'Expenses'}
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
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="#2F765B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#finoraIncomeGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="#D97757"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#finoraExpenseGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown Donut */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <div>
              <CardTitle>Expense Breakdown</CardTitle>
              <CardDescription>Click a segment to filter transactions</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <EmptyState
                icon={<Wallet className="h-5 w-5" />}
                title="No expenses this month"
                description="Expenses recorded in this month will appear here."
                className="py-10"
              />
            ) : (
              <>
                <div
                  className="h-[190px] w-full"
                  role="img"
                  aria-label="Expense breakdown by category donut chart"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="amountPaise"
                        nameKey="label"
                        innerRadius={54}
                        outerRadius={78}
                        paddingAngle={2}
                        className="cursor-pointer"
                        onClick={(entry) => {
                          if (entry?.category) {
                            navigate(`/transactions?category=${entry.category}`);
                          }
                        }}
                      >
                        {categoryBreakdown.map((item) => (
                          <Cell key={item.category} fill={item.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const item = payload[0].payload as (typeof categoryBreakdown)[number];
                          return (
                            <div className="rounded-lg border border-[#E5E9E3] bg-white px-3 py-2 text-xs shadow-lg dark:border-[#24332C] dark:bg-[#151E1A]">
                              <div className="font-semibold text-[#18231E] dark:text-[#EDF2EE]">
                                {item.label}
                              </div>
                              <div className="mt-0.5 tabular-nums text-[#66736A] dark:text-[#9EADA4]">
                                {fmt(item.amountPaise)} ({item.percentage}%)
                              </div>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-2 space-y-2">
                  {categoryBreakdown.slice(0, 5).map((item) => (
                    <button
                      key={item.category}
                      type="button"
                      onClick={() => navigate(`/transactions?category=${item.category}`)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-xs transition-colors hover:bg-[#F7F8F5] dark:hover:bg-[#1C2722] cursor-pointer"
                    >
                      <span className="flex items-center gap-2 text-[#18231E] dark:text-[#EDF2EE]">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                      </span>
                      <span className="tabular-nums font-medium text-[#66736A] dark:text-[#9EADA4]">
                        {fmt(item.amountPaise)} · {item.percentage}%
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Recent Transactions (7 cols) + Budgets & Goals (5 cols) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Recent Transactions */}
        <Card className="lg:col-span-7">
          <CardHeader className="flex-col sm:flex-row sm:items-center">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your latest financial activity</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#929B94]" />
                <input
                  type="text"
                  value={recentQuery}
                  onChange={(e) => setRecentQuery(e.target.value)}
                  placeholder="Filter..."
                  className="h-8 w-36 rounded-lg border border-[#E5E9E3] bg-[#F7F8F5] pl-8 pr-2.5 text-xs text-[#18231E] placeholder:text-[#929B94] focus:border-[#2F765B] focus:outline-none dark:border-[#24332C] dark:bg-[#1C2722] dark:text-[#EDF2EE]"
                />
              </div>
              <Link
                to="/transactions"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2F765B] hover:underline"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <EmptyState
                icon={<Search className="h-5 w-5" />}
                title="No matching transactions"
                description="Try clearing your search filter or add a new transaction."
              />
            ) : (
              <div className="divide-y divide-[#E5E9E3] dark:divide-[#24332C]">
                {recentTransactions.map((tx) => {
                  const cat = getCategoryMeta(tx.category);
                  const account = accountMap.get(tx.accountId);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => openTransactionDrawer(tx.id)}
                      className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-[#F7F8F5]/70 dark:hover:bg-[#1C2722]/50 -mx-2 px-2 rounded-lg cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
                          style={{ backgroundColor: cat.bgTint, color: cat.color }}
                        >
                          {tx.type === 'income' ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[#18231E] dark:text-[#EDF2EE]">
                            {tx.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#66736A] dark:text-[#9EADA4]">
                            <span>{cat.label}</span>
                            <span>·</span>
                            <span>{account?.name ?? 'Account'}</span>
                            <span className="hidden sm:inline">·</span>
                            <span className="hidden sm:inline">
                              {formatDisplayDate(tx.date, preferences.dateFormat)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          tx.type === 'income'
                            ? 'text-[#2F765B] dark:text-[#7FD1AE]'
                            : tx.type === 'transfer'
                              ? 'text-[#66736A] dark:text-[#9EADA4]'
                              : 'text-[#18231E] dark:text-[#EDF2EE]'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {fmt(tx.amountPaise)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Overview + Savings Goals Preview */}
        <div className="space-y-5 lg:col-span-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Budget Overview</CardTitle>
                <CardDescription>{getMonthLabel(selectedMonth)}</CardDescription>
              </div>
              <Link
                to="/budgets"
                className="text-xs font-medium text-[#2F765B] hover:underline"
              >
                Manage
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-[#F7F8F5] p-3 dark:bg-[#1C2722]">
                <div>
                  <div className="text-[11px] text-[#66736A] dark:text-[#9EADA4]">Budget</div>
                  <div className="mt-0.5 text-xs font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
                    {fmt(totalBudgetLimit)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#66736A] dark:text-[#9EADA4]">Spent</div>
                  <div className="mt-0.5 text-xs font-semibold tabular-nums text-[#D97757]">
                    {fmt(totalBudgetSpent)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-[#66736A] dark:text-[#9EADA4]">Remaining</div>
                  <div
                    className={`mt-0.5 text-xs font-semibold tabular-nums ${
                      totalBudgetRemaining >= 0
                        ? 'text-[#2F765B] dark:text-[#7FD1AE]'
                        : 'text-[#D9534F]'
                    }`}
                  >
                    {fmt(totalBudgetRemaining)}
                  </div>
                </div>
              </div>

              {monthBudgets.length === 0 ? (
                <p className="text-xs text-[#66736A] dark:text-[#9EADA4]">
                  No budgets set for {getMonthLabel(selectedMonth)}.
                </p>
              ) : (
                <div className="space-y-3">
                  {monthBudgets.slice(0, 4).map((b) => {
                    const cat = getCategoryMeta(b.category);
                    return (
                      <div key={b.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#18231E] dark:text-[#EDF2EE]">
                            {cat.label}
                          </span>
                          <span className="tabular-nums text-[#66736A] dark:text-[#9EADA4]">
                            {fmt(b.spentPaise)} / {fmt(b.limitPaise)}
                          </span>
                        </div>
                        <ProgressBar value={b.utilizationPct} status={b.status} />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Savings Goals</CardTitle>
                <CardDescription>Active targets</CardDescription>
              </div>
              <Link
                to="/goals"
                className="text-xs font-medium text-[#2F765B] hover:underline"
              >
                View goals
              </Link>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {goals.slice(0, 3).map((goal) => {
                const { progressPct } = computeGoalProgress(goal);
                return (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#18231E] dark:text-[#EDF2EE]">
                        {goal.title}
                      </span>
                      <span className="tabular-nums font-medium text-[#2F765B] dark:text-[#7FD1AE]">
                        {progressPct}%
                      </span>
                    </div>
                    <ProgressBar value={progressPct} status="gold" />
                    <div className="flex items-center justify-between text-[11px] text-[#929B94] dark:text-[#6C7A72] tabular-nums">
                      <span>
                        {fmt(goal.currentPaise)} of {fmt(goal.targetPaise)}
                      </span>
                      <span>Due {formatDisplayDate(goal.deadline, preferences.dateFormat)}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
