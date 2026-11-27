import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bell,
  Calendar,
  CreditCard,
  FileText,
  LayoutDashboard,
  PiggyBank,
  Plus,
  Repeat,
  Search,
  Settings,
  Target,
  Wallet,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFinoraStore } from '@/stores/useFinoraStore';
import { formatMoney } from '@/utils/money';

interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  group: 'Actions' | 'Navigation' | 'Transactions' | 'Goals';
  icon: React.ReactNode;
  onSelect: () => void;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const open = useFinoraStore((s) => s.isCommandPaletteOpen);
  const setOpen = useFinoraStore((s) => s.setCommandPaletteOpen);
  const openTransactionDrawer = useFinoraStore((s) => s.openTransactionDrawer);
  const transactions = useFinoraStore((s) => s.transactions);
  const goals = useFinoraStore((s) => s.goals);
  const currency = useFinoraStore((s) => s.preferences.currency);
  const numberFormat = useFinoraStore((s) => s.preferences.numberFormat);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!open);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const navItems: CommandItem[] = [
      {
        id: 'act-add-tx',
        label: 'Add Transaction',
        subtitle: 'Record a new income, expense, or transfer',
        group: 'Actions',
        icon: <Plus className="h-4 w-4 text-[#2F765B]" />,
        onSelect: () => {
          setOpen(false);
          openTransactionDrawer(null);
        },
      },
      {
        id: 'nav-dashboard',
        label: 'Dashboard',
        subtitle: 'Overview & financial health',
        group: 'Navigation',
        icon: <LayoutDashboard className="h-4 w-4" />,
        onSelect: () => {
          navigate('/dashboard');
          setOpen(false);
        },
      },
      {
        id: 'nav-transactions',
        label: 'Transactions',
        subtitle: 'All income, expenses & transfers',
        group: 'Navigation',
        icon: <CreditCard className="h-4 w-4" />,
        onSelect: () => {
          navigate('/transactions');
          setOpen(false);
        },
      },
      {
        id: 'nav-analytics',
        label: 'Analytics',
        subtitle: 'Spending trends & cash flow',
        group: 'Navigation',
        icon: <BarChart3 className="h-4 w-4" />,
        onSelect: () => {
          navigate('/analytics');
          setOpen(false);
        },
      },
      {
        id: 'nav-budgets',
        label: 'Budgets',
        subtitle: 'Monthly category limits',
        group: 'Navigation',
        icon: <PiggyBank className="h-4 w-4" />,
        onSelect: () => {
          navigate('/budgets');
          setOpen(false);
        },
      },
      {
        id: 'nav-goals',
        label: 'Savings Goals',
        subtitle: 'Track target milestones',
        group: 'Navigation',
        icon: <Target className="h-4 w-4" />,
        onSelect: () => {
          navigate('/goals');
          setOpen(false);
        },
      },
      {
        id: 'nav-recurring',
        label: 'Recurring Payments',
        subtitle: 'Subscriptions & bills',
        group: 'Navigation',
        icon: <Repeat className="h-4 w-4" />,
        onSelect: () => {
          navigate('/recurring');
          setOpen(false);
        },
      },
      {
        id: 'nav-accounts',
        label: 'Accounts & Wallets',
        subtitle: 'Balances & internal transfers',
        group: 'Navigation',
        icon: <Wallet className="h-4 w-4" />,
        onSelect: () => {
          navigate('/accounts');
          setOpen(false);
        },
      },
      {
        id: 'nav-calendar',
        label: 'Calendar',
        subtitle: 'Daily financial activity',
        group: 'Navigation',
        icon: <Calendar className="h-4 w-4" />,
        onSelect: () => {
          navigate('/calendar');
          setOpen(false);
        },
      },
      {
        id: 'nav-reports',
        label: 'Reports',
        subtitle: 'Monthly & annual statements',
        group: 'Navigation',
        icon: <FileText className="h-4 w-4" />,
        onSelect: () => {
          navigate('/reports');
          setOpen(false);
        },
      },
      {
        id: 'nav-notifications',
        label: 'Notifications',
        subtitle: 'Alerts & reminders',
        group: 'Navigation',
        icon: <Bell className="h-4 w-4" />,
        onSelect: () => {
          navigate('/notifications');
          setOpen(false);
        },
      },
      {
        id: 'nav-settings',
        label: 'Settings',
        subtitle: 'Profile, currency, theme & data',
        group: 'Navigation',
        icon: <Settings className="h-4 w-4" />,
        onSelect: () => {
          navigate('/settings');
          setOpen(false);
        },
      },
    ];

    const q = query.trim().toLowerCase();
    if (!q) return navItems;

    const matchingTxs: CommandItem[] = transactions
      .filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          (t.notes?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 6)
      .map((t) => ({
        id: `tx-${t.id}`,
        label: t.title,
        subtitle: `${t.date} · ${formatMoney(t.amountPaise, { currency, numberFormat })}`,
        group: 'Transactions',
        icon: <CreditCard className="h-4 w-4" />,
        onSelect: () => {
          setOpen(false);
          openTransactionDrawer(t.id);
        },
      }));

    const matchingGoals: CommandItem[] = goals
      .filter((g) => g.title.toLowerCase().includes(q))
      .slice(0, 3)
      .map((g) => ({
        id: `goal-${g.id}`,
        label: g.title,
        subtitle: `Goal · ${formatMoney(g.currentPaise, { currency, numberFormat })} / ${formatMoney(g.targetPaise, { currency, numberFormat })}`,
        group: 'Goals',
        icon: <Target className="h-4 w-4" />,
        onSelect: () => {
          setOpen(false);
          navigate('/goals');
        },
      }));

    const filteredNav = navItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.subtitle?.toLowerCase().includes(q) ?? false),
    );

    return [...filteredNav, ...matchingTxs, ...matchingGoals];
  }, [query, transactions, goals, currency, numberFormat, navigate, setOpen, openTransactionDrawer]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        items.length ? (prev - 1 + items.length) % items.length : 0,
      );
    } else if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      items[activeIndex].onSelect();
    }
  };

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh] px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Global command palette"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-[#102F27]/40 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.15 }}
            onKeyDown={handleKeyDown}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-[#E5E9E3] bg-white shadow-2xl dark:border-[#24332C] dark:bg-[#151E1A]"
          >
            <div className="flex items-center gap-3 border-b border-[#E5E9E3] px-4 py-3 dark:border-[#24332C]">
              <Search className="h-4 w-4 text-[#929B94]" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search"
                className="w-full bg-transparent text-sm text-[#18231E] placeholder:text-[#929B94] focus:outline-none dark:text-[#EDF2EE]"
              />
              <kbd className="rounded-md border border-[#E5E9E3] bg-[#F7F8F5] px-1.5 py-0.5 text-[10px] font-medium text-[#66736A] dark:border-[#24332C] dark:bg-[#1C2722] dark:text-[#9EADA4]">
                ESC
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-[#66736A] dark:text-[#9EADA4]">
                  No matching commands or records found.
                </p>
              ) : (
                items.map((item, idx) => {
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={item.onSelect}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#E5EFE8] text-[#153D32] dark:bg-[#1A3329] dark:text-[#EDF2EE]'
                          : 'text-[#18231E] hover:bg-[#F7F8F5] dark:text-[#EDF2EE] dark:hover:bg-[#1C2722]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="shrink-0 text-[#66736A] dark:text-[#9EADA4]">
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{item.label}</div>
                          {item.subtitle ? (
                            <div className="truncate text-xs text-[#66736A] dark:text-[#9EADA4]">
                              {item.subtitle}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
