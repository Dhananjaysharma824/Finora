import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFinoraStore } from '@/stores/useFinoraStore';
import type { CategoryId, Transaction, TransactionType } from '@/types/finance';
import { formatMoney, isValidMajorAmount, toPaise } from '@/utils/money';
import { formatDisplayDate } from '@/utils/dates';
import { CATEGORIES, getCategoryMeta } from '@/utils/categories';
import { sanitizeCsvCell } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';

const columnHelper = createColumnHelper<Transaction>();
const MAX_CSV_BYTES = 1_048_576; // 1 MB
const MAX_CSV_ROWS = 1000;

function parseCsvDocument(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = '';
    } else {
      current += ch;
    }
  }
  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) {
    rows.push(row);
  }
  return rows;
}

export default function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawCategoryParam = searchParams.get('category');
  const initialCategory =
    rawCategoryParam && rawCategoryParam in CATEGORIES ? rawCategoryParam : 'all';

  const transactions = useFinoraStore((s) => s.transactions);
  const accounts = useFinoraStore((s) => s.accounts);
  const preferences = useFinoraStore((s) => s.preferences);
  const openTransactionDrawer = useFinoraStore((s) => s.openTransactionDrawer);
  const deleteTransaction = useFinoraStore((s) => s.deleteTransaction);
  const importTransactions = useFinoraStore((s) => s.importTransactions);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);

  useEffect(() => {
    const param = searchParams.get('category');
    setCategoryFilter(param && param in CATEGORIES ? param : 'all');
  }, [searchParams]);
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const filteredData = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (categoryFilter !== 'all' && tx.category !== categoryFilter) return false;
      if (accountFilter !== 'all' && tx.accountId !== accountFilter && tx.toAccountId !== accountFilter)
        return false;
      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      if (startDate && tx.date < startDate) return false;
      if (endDate && tx.date > endDate) return false;
      if (q) {
        const catLabel = getCategoryMeta(tx.category).label.toLowerCase();
        const accName = accountMap.get(tx.accountId)?.name.toLowerCase() ?? '';
        const matches =
          tx.title.toLowerCase().includes(q) ||
          catLabel.includes(q) ||
          accName.includes(q) ||
          (tx.notes?.toLowerCase().includes(q) ?? false);
        if (!matches) return false;
      }
      return true;
    });
  }, [transactions, categoryFilter, accountFilter, typeFilter, startDate, endDate, search, accountMap]);

  const fmt = (paise: number) =>
    formatMoney(paise, {
      currency: preferences.currency,
      numberFormat: preferences.numberFormat,
    });

  const columns = useMemo(
    () => [
      columnHelper.accessor('title', {
        header: 'Transaction',
        cell: (info) => {
          const tx = info.row.original;
          return (
            <div>
              <div className="font-medium text-[#18231E] dark:text-[#EDF2EE]">
                {tx.title}
              </div>
              {tx.notes ? (
                <div className="max-w-[240px] truncate text-xs text-[#929B94] dark:text-[#6C7A72]">
                  {tx.notes}
                </div>
              ) : null}
            </div>
          );
        },
      }),
      columnHelper.accessor('category', {
        header: 'Category',
        cell: (info) => {
          const meta = getCategoryMeta(info.getValue());
          return <Badge dotColor={meta.color}>{meta.label}</Badge>;
        },
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: (info) => {
          const t = info.getValue();
          return (
            <Badge
              variant={
                t === 'income' ? 'success' : t === 'expense' ? 'coral' : 'neutral'
              }
              className="capitalize"
            >
              {t}
            </Badge>
          );
        },
      }),
      columnHelper.accessor('accountId', {
        header: 'Account',
        cell: (info) => {
          const tx = info.row.original;
          const from = accountMap.get(tx.accountId)?.name ?? 'Account';
          if (tx.type === 'transfer' && tx.toAccountId) {
            const to = accountMap.get(tx.toAccountId)?.name ?? 'Account';
            return (
              <span className="text-xs text-[#66736A] dark:text-[#9EADA4]">
                {from} → {to}
              </span>
            );
          }
          return <span className="text-xs text-[#66736A] dark:text-[#9EADA4]">{from}</span>;
        },
      }),
      columnHelper.accessor('date', {
        header: 'Date',
        cell: (info) => (
          <span className="text-xs tabular-nums text-[#66736A] dark:text-[#9EADA4]">
            {formatDisplayDate(info.getValue(), preferences.dateFormat)}
          </span>
        ),
      }),
      columnHelper.accessor('amountPaise', {
        header: () => <div className="text-right">Amount</div>,
        cell: (info) => {
          const tx = info.row.original;
          return (
            <div
              className={`text-right font-semibold tabular-nums ${
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
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <div className="text-right">Actions</div>,
        cell: (info) => {
          const tx = info.row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={() => openTransactionDrawer(tx.id)}
                aria-label={`Edit ${tx.title}`}
                className="rounded-lg p-1.5 text-[#66736A] transition-colors hover:bg-[#EEF1EC] hover:text-[#18231E] dark:text-[#9EADA4] dark:hover:bg-[#1C2722] cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDeleteTargetId(tx.id)}
                aria-label={`Delete ${tx.title}`}
                className="rounded-lg p-1.5 text-[#66736A] transition-colors hover:bg-[#FBEAEA] hover:text-[#D9534F] dark:text-[#9EADA4] dark:hover:bg-[#361B1A] cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        },
      }),
    ],
    [accountMap, preferences.dateFormat, preferences.currency, preferences.numberFormat, openTransactionDrawer],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 },
    },
  });

  const handleExportCsv = () => {
    const header = ['Title', 'Type', 'Category', 'Account', 'Date', 'Amount', 'Notes'];
    const rows = filteredData.map((tx) => [
      sanitizeCsvCell(tx.title),
      sanitizeCsvCell(tx.type),
      sanitizeCsvCell(tx.category),
      sanitizeCsvCell(accountMap.get(tx.accountId)?.name ?? ''),
      sanitizeCsvCell(tx.date),
      (tx.amountPaise / 100).toFixed(2),
      sanitizeCsvCell(tx.notes ?? ''),
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finora-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredData.length} transactions`);
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const lowerName = file.name.toLowerCase();
      const allowedTypes = new Set(['text/csv', 'application/vnd.ms-excel', 'text/plain', '']);
      if (!lowerName.endsWith('.csv') || !allowedTypes.has(file.type)) {
        toast.error('Only valid .csv files are supported');
        return;
      }
      if (file.size > MAX_CSV_BYTES) {
        toast.error('CSV file exceeds the 1 MB size limit');
        return;
      }

      const text = await file.text();
      const rows = parseCsvDocument(text);
      if (rows.length < 2) {
        toast.error('CSV file has no data rows');
        return;
      }

      const defaultAccountId = accounts[0]?.id ?? 'acc_main';
      const parsedItems: Array<Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>> = [];

      for (const cols of rows.slice(1, MAX_CSV_ROWS + 1)) {
        if (cols.length < 6) continue;
        const [title, typeRaw, catRaw, accName, dateRaw, amountRaw, notes] = cols;
        const amountNum = Number(amountRaw);
        if (!title || !isValidMajorAmount(amountNum)) continue;

        const type: TransactionType =
          typeRaw === 'income' || typeRaw === 'expense' || typeRaw === 'transfer'
            ? typeRaw
            : 'expense';
        const category: CategoryId =
          catRaw in CATEGORIES ? (catRaw as CategoryId) : type === 'income' ? 'other_income' : 'other';
        const matchedAcc = accounts.find(
          (a) => a.name.toLowerCase() === (accName ?? '').toLowerCase(),
        );
        const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
          ? dateRaw
          : new Date().toISOString().slice(0, 10);

        parsedItems.push({
          title: title.slice(0, 100),
          type,
          category,
          accountId: matchedAcc?.id ?? defaultAccountId,
          date,
          amountPaise: toPaise(amountNum),
          notes: notes ? notes.slice(0, 400) : undefined,
        });
      }

      if (parsedItems.length === 0) {
        toast.error('No valid transactions found in CSV');
        return;
      }

      const count = importTransactions(parsedItems);
      toast.success(`Imported ${count} transactions`);
    } catch {
      toast.error('Failed to parse CSV file');
    } finally {
      e.target.value = '';
    }
  };

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setAccountFilter('all');
    setTypeFilter('all');
    setStartDate('');
    setEndDate('');
    setSearchParams({});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-[#18231E] dark:text-[#EDF2EE]">
            Transactions
          </h2>
          <p className="mt-0.5 text-sm text-[#66736A] dark:text-[#9EADA4]">
            Track every rupee coming in and going out.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleImportCsv}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<Upload className="h-3.5 w-3.5" />}
          >
            Import CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            Export CSV
          </Button>
          <Button
            onClick={() => openTransactionDrawer(null)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#929B94]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, category, account, notes..."
                className="h-9 w-full rounded-lg border border-[#E5E9E3] bg-[#F7F8F5] pl-9 pr-3 text-xs text-[#18231E] placeholder:text-[#929B94] focus:border-[#2F765B] focus:outline-none dark:border-[#24332C] dark:bg-[#1C2722] dark:text-[#EDF2EE]"
              />
            </div>

            <select
              aria-label="Filter by type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E9E3] bg-white px-3 text-xs text-[#18231E] focus:border-[#2F765B] focus:outline-none dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#EDF2EE] cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
              <option value="transfer">Transfer</option>
            </select>

            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E9E3] bg-white px-3 text-xs text-[#18231E] focus:border-[#2F765B] focus:outline-none dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#EDF2EE] cursor-pointer"
            >
              <option value="all">All Categories</option>
              {Object.values(CATEGORIES).map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by account"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#E5E9E3] bg-white px-3 text-xs text-[#18231E] focus:border-[#2F765B] focus:outline-none dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#EDF2EE] cursor-pointer"
            >
              <option value="all">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Start date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#E5E9E3] bg-white px-2 text-xs text-[#18231E] dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#EDF2EE]"
              />
              <input
                type="date"
                aria-label="End date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#E5E9E3] bg-white px-2 text-xs text-[#18231E] dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#EDF2EE]"
              />
            </div>
          </div>
          {(search || categoryFilter !== 'all' || accountFilter !== 'all' || typeFilter !== 'all' || startDate || endDate) ? (
            <div className="mt-3 flex items-center justify-between text-xs text-[#66736A] dark:text-[#9EADA4]">
              <span>Showing {filteredData.length} matching transactions</span>
              <button
                type="button"
                onClick={clearFilters}
                className="font-medium text-[#2F765B] hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {filteredData.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" />}
          title="No transactions found"
          description="Adjust your filters or add a new transaction to start tracking."
          action={
            <Button onClick={() => openTransactionDrawer(null)} leftIcon={<Plus className="h-4 w-4" />}>
              Add Transaction
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr
                      key={hg.id}
                      className="border-b border-[#E5E9E3] bg-[#F7F8F5] text-xs font-medium text-[#66736A] dark:border-[#24332C] dark:bg-[#1C2722] dark:text-[#9EADA4]"
                    >
                      {hg.headers.map((header) => (
                        <th key={header.id} className="px-4 py-3 font-medium">
                          {header.isPlaceholder ? null : (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="inline-flex items-center gap-1 hover:text-[#18231E] dark:hover:text-[#EDF2EE] cursor-pointer"
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {header.column.getCanSort() ? (
                                <ArrowDownUp className="h-3 w-3 opacity-40" />
                              ) : null}
                            </button>
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-[#E5E9E3] dark:divide-[#24332C]">
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="transition-colors hover:bg-[#F7F8F5]/70 dark:hover:bg-[#1C2722]/40"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3.5 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-[#E5E9E3] px-4 py-3 text-xs text-[#66736A] dark:border-[#24332C] dark:text-[#9EADA4]">
              <span>
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()} ({filteredData.length} total)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  leftIcon={<ChevronLeft className="h-3.5 w-3.5" />}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  rightIcon={<ChevronRight className="h-3.5 w-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>

          {/* Mobile Transaction Cards */}
          <div className="space-y-3 md:hidden">
            {table.getRowModel().rows.map((row) => {
              const tx = row.original;
              const cat = getCategoryMeta(tx.category);
              const acc = accountMap.get(tx.accountId);
              return (
                <Card key={tx.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#18231E] dark:text-[#EDF2EE]">
                          {tx.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge dotColor={cat.color}>{cat.label}</Badge>
                          <span className="text-xs text-[#66736A] dark:text-[#9EADA4]">
                            {acc?.name}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          tx.type === 'income'
                            ? 'text-[#2F765B] dark:text-[#7FD1AE]'
                            : 'text-[#18231E] dark:text-[#EDF2EE]'
                        }`}
                      >
                        {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                        {fmt(tx.amountPaise)}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-[#E5E9E3] pt-2.5 text-xs text-[#929B94] dark:border-[#24332C]">
                      <span>{formatDisplayDate(tx.date, preferences.dateFormat)}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openTransactionDrawer(tx.id)}
                          className="font-medium text-[#2F765B] cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(tx.id)}
                          className="font-medium text-[#D9534F] cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            <div className="flex items-center justify-between pt-2 text-xs text-[#66736A]">
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Prev
              </Button>
              <span>
                Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            deleteTransaction(deleteTargetId);
            toast.success('Transaction deleted');
          }
        }}
        title="Delete Transaction"
        description="Are you sure you want to delete this transaction? Account balances and budgets will update immediately."
        confirmLabel="Delete"
      />
    </div>
  );
}
