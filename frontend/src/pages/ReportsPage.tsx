import { useMemo, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useFinoraStore } from '@/stores/useFinoraStore';
import {
  computeBudgetStats,
  computeCategoryBreakdown,
  computeGoalProgress,
  computePeriodSummary,
  filterTransactionsByMonth,
} from '@/utils/calculations';
import { getMonthLabel, getRecentMonthKeys } from '@/utils/dates';
import { getCategoryMeta } from '@/utils/categories';
import { formatMoney } from '@/utils/money';
import { sanitizeCsvCell } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function ReportsPage() {
  const transactions = useFinoraStore((s) => s.transactions);
  const budgets = useFinoraStore((s) => s.budgets);
  const goals = useFinoraStore((s) => s.goals);
  const preferences = useFinoraStore((s) => s.preferences);
  const selectedMonth = useFinoraStore((s) => s.selectedMonth);

  const [scope, setScope] = useState<'monthly' | 'annual'>('monthly');
  const [reportMonth, setReportMonth] = useState(selectedMonth);
  const currentYear = new Date().getFullYear().toString();
  const [reportYear, setReportYear] = useState(currentYear);

  const monthOptions = useMemo(() => getRecentMonthKeys(12), []);

  const scopedTransactions = useMemo(() => {
    if (scope === 'monthly') {
      return filterTransactionsByMonth(transactions, reportMonth);
    }
    return transactions.filter((t) => t.date.startsWith(reportYear));
  }, [scope, transactions, reportMonth, reportYear]);

  const summary = useMemo(
    () => computePeriodSummary(scopedTransactions),
    [scopedTransactions],
  );

  const expenseCategories = useMemo(
    () => computeCategoryBreakdown(scopedTransactions, 'expense'),
    [scopedTransactions],
  );

  const incomeCategories = useMemo(
    () => computeCategoryBreakdown(scopedTransactions, 'income'),
    [scopedTransactions],
  );

  const budgetPerformance = useMemo(
    () =>
      computeBudgetStats(
        scope === 'monthly'
          ? budgets.filter((b) => b.month === reportMonth)
          : budgets.filter((b) => b.month.startsWith(reportYear)),
        transactions,
      ),
    [scope, budgets, reportMonth, reportYear, transactions],
  );

  const fmt = (paise: number, showSign = false) =>
    formatMoney(paise, {
      currency: preferences.currency,
      numberFormat: preferences.numberFormat,
      showSign,
    });

  const handleExportCsv = () => {
    const lines = [
      `Finora Financial Report (${scope === 'monthly' ? getMonthLabel(reportMonth) : reportYear})`,
      '',
      'Summary,Amount',
      `Total Income,${(summary.incomePaise / 100).toFixed(2)}`,
      `Total Expenses,${(summary.expensePaise / 100).toFixed(2)}`,
      `Net Cash Flow,${(summary.netCashFlowPaise / 100).toFixed(2)}`,
      `Savings Rate,${summary.savingsRate}%`,
      '',
      'Expense Category,Amount,Share (%)',
      ...expenseCategories.map(
        (c) => `${sanitizeCsvCell(c.label)},${(c.amountPaise / 100).toFixed(2)},${c.percentage}%`,
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finora-report-${scope === 'monthly' ? reportMonth : reportYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported as CSV');
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between no-print">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[#18231E] dark:text-[#EDF2EE]">
            Financial Reports
          </h2>
          <p className="mt-0.5 text-sm text-[#66736A] dark:text-[#9EADA4]">
            Print-ready monthly and annual statements generated from your records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg bg-[#EEF1EC] p-1 dark:bg-[#1C2722]">
            <button
              type="button"
              onClick={() => setScope('monthly')}
              className={`rounded-lg px-3 py-1 text-xs font-medium cursor-pointer ${
                scope === 'monthly'
                  ? 'bg-white text-[#153D32] shadow-xs dark:bg-[#151E1A] dark:text-[#EDF2EE]'
                  : 'text-[#66736A]'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setScope('annual')}
              className={`rounded-lg px-3 py-1 text-xs font-medium cursor-pointer ${
                scope === 'annual'
                  ? 'bg-white text-[#153D32] shadow-xs dark:bg-[#151E1A] dark:text-[#EDF2EE]'
                  : 'text-[#66736A]'
              }`}
            >
              Annual
            </button>
          </div>

          {scope === 'monthly' ? (
            <select
              aria-label="Report month"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E9E3] bg-white px-3 text-xs dark:border-[#24332C] dark:bg-[#151E1A] cursor-pointer"
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {getMonthLabel(m)}
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label="Report year"
              value={reportYear}
              onChange={(e) => setReportYear(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E9E3] bg-white px-3 text-xs dark:border-[#24332C] dark:bg-[#151E1A] cursor-pointer"
            >
              <option value={currentYear}>{currentYear}</option>
              <option value={String(Number(currentYear) - 1)}>
                {Number(currentYear) - 1}
              </option>
            </select>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={handlePrintPdf}
            leftIcon={<Printer className="h-3.5 w-3.5" />}
          >
            Print / PDF
          </Button>
        </div>
      </div>

      {/* Report Header Statement */}
      <Card>
        <CardHeader className="border-b border-[#E5E9E3] pb-4 dark:border-[#24332C]">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#153D32] text-[#F7F8F5]">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <CardTitle>
                FINORA {scope === 'monthly' ? 'Monthly' : 'Annual'} Financial Statement
              </CardTitle>
              <CardDescription>
                Period: {scope === 'monthly' ? getMonthLabel(reportMonth) : reportYear} ·{' '}
                {summary.transactionCount} recorded transactions
              </CardDescription>
            </div>
          </div>
          <Badge variant="forest">Verified Local Ledger</Badge>
        </CardHeader>

        <CardContent className="grid grid-cols-2 gap-4 pt-5 sm:grid-cols-4">
          <div>
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Income</div>
            <div className="mt-1 font-display text-xl font-semibold tabular-nums text-[#2F765B] dark:text-[#7FD1AE]">
              {fmt(summary.incomePaise)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Expenses</div>
            <div className="mt-1 font-display text-xl font-semibold tabular-nums text-[#D97757]">
              {fmt(summary.expensePaise)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Net Cash Flow</div>
            <div className="mt-1 font-display text-xl font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
              {fmt(summary.netCashFlowPaise, true)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#66736A] dark:text-[#9EADA4]">Savings Rate</div>
            <div className="mt-1 font-display text-xl font-semibold tabular-nums text-[#18231E] dark:text-[#EDF2EE]">
              {summary.savingsRate}%
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Income Report */}
        <Card>
          <CardHeader>
            <CardTitle>Income Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {incomeCategories.length === 0 ? (
              <p className="text-xs text-[#66736A]">No income recorded in this period.</p>
            ) : (
              <div className="divide-y divide-[#E5E9E3] dark:divide-[#24332C]">
                {incomeCategories.map((c) => (
                  <div key={c.category} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.label}
                    </span>
                    <span className="tabular-nums font-semibold text-[#2F765B] dark:text-[#7FD1AE]">
                      {fmt(c.amountPaise)} ({c.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense Report */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseCategories.length === 0 ? (
              <p className="text-xs text-[#66736A]">No expenses recorded in this period.</p>
            ) : (
              <div className="divide-y divide-[#E5E9E3] dark:divide-[#24332C]">
                {expenseCategories.map((c) => (
                  <div key={c.category} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.label}
                    </span>
                    <span className="tabular-nums font-semibold text-[#18231E] dark:text-[#EDF2EE]">
                      {fmt(c.amountPaise)} ({c.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budget Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {budgetPerformance.length === 0 ? (
              <p className="text-xs text-[#66736A]">No budgets configured for this period.</p>
            ) : (
              <div className="divide-y divide-[#E5E9E3] dark:divide-[#24332C]">
                {budgetPerformance.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2.5 text-xs">
                    <span className="font-medium text-sm text-[#18231E] dark:text-[#EDF2EE]">
                      {getCategoryMeta(b.category).label}
                    </span>
                    <div className="flex items-center gap-2.5 tabular-nums">
                      <span className="text-[#66736A] dark:text-[#9EADA4]">
                        {fmt(b.spentPaise)} / {fmt(b.limitPaise)}
                      </span>
                      <Badge
                        variant={
                          b.status === 'exceeded'
                            ? 'danger'
                            : b.status === 'warning'
                              ? 'warning'
                              : 'success'
                        }
                      >
                        {b.utilizationPct}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Savings Report */}
        <Card>
          <CardHeader>
            <CardTitle>Savings Goals Status</CardTitle>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <p className="text-xs text-[#66736A]">No active savings goals.</p>
            ) : (
              <div className="divide-y divide-[#E5E9E3] dark:divide-[#24332C]">
                {goals.map((g) => {
                  const { progressPct } = computeGoalProgress(g);
                  return (
                    <div key={g.id} className="flex items-center justify-between py-2.5 text-xs">
                      <span className="text-sm font-medium text-[#18231E] dark:text-[#EDF2EE]">
                        {g.title}
                      </span>
                      <div className="flex items-center gap-2.5 tabular-nums">
                        <span className="text-[#66736A] dark:text-[#9EADA4]">
                          {fmt(g.currentPaise)} / {fmt(g.targetPaise)}
                        </span>
                        <Badge variant="gold">{progressPct}%</Badge>
                      </div>
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
