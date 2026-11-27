import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Moon, Plus, Search, Sun } from 'lucide-react';
import { useFinoraStore, selectUnreadNotificationCount } from '@/stores/useFinoraStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/Button';

const ROUTE_TITLES: Record<string, { title: string; parent?: string }> = {
  '/dashboard': { title: 'Dashboard', parent: 'Overview' },
  '/transactions': { title: 'Transactions', parent: 'Money' },
  '/analytics': { title: 'Analytics', parent: 'Money' },
  '/budgets': { title: 'Budgets', parent: 'Money' },
  '/goals': { title: 'Savings Goals', parent: 'Money' },
  '/recurring': { title: 'Recurring Payments', parent: 'Money' },
  '/accounts': { title: 'Accounts & Wallets', parent: 'Money' },
  '/calendar': { title: 'Calendar', parent: 'Planning' },
  '/reports': { title: 'Reports', parent: 'Planning' },
  '/notifications': { title: 'Notifications', parent: 'Activity' },
  '/settings': { title: 'Settings', parent: 'Preferences' },
};

interface TopbarProps {
  onOpenMobileNav: () => void;
}

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const profile = useFinoraStore((s) => s.profile);
  const theme = useFinoraStore((s) => s.preferences.theme);
  const updatePreferences = useFinoraStore((s) => s.updatePreferences);
  const setCommandPaletteOpen = useFinoraStore((s) => s.setCommandPaletteOpen);
  const openTransactionDrawer = useFinoraStore((s) => s.openTransactionDrawer);
  const unreadCount = useFinoraStore(selectUnreadNotificationCount);
  const authMode = useAuthStore((s) => s.authMode);
  const logout = useAuthStore((s) => s.logout);

  const meta = ROUTE_TITLES[pathname] ?? { title: 'Finora' };
  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    updatePreferences({ theme: next });
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#E5E9E3] bg-[#F7F8F5]/90 px-4 backdrop-blur-md sm:px-6 lg:px-8 dark:border-[#24332C] dark:bg-[#0E1512]/90">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E9E3] bg-white text-[#18231E] lg:hidden dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#EDF2EE] cursor-pointer"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-[#929B94] dark:text-[#6C7A72]">
            <span>Finora</span>
            {meta.parent ? (
              <>
                <span>/</span>
                <span>{meta.parent}</span>
              </>
            ) : null}
          </div>
          <h1 className="truncate font-display text-sm font-semibold text-[#18231E] sm:text-base dark:text-[#EDF2EE]">
            {meta.title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden sm:flex h-9 w-52 md:w-64 items-center justify-between rounded-lg border border-[#E5E9E3] bg-white px-3 text-xs text-[#929B94] transition-colors hover:border-[#2F765B]/50 hover:text-[#66736A] dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#6C7A72] cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5" />
            <span>Search</span>
          </span>
          <kbd className="rounded border border-[#E5E9E3] bg-[#F7F8F5] px-1.5 py-0.5 text-[10px] font-medium text-[#66736A] dark:border-[#24332C] dark:bg-[#1C2722] dark:text-[#9EADA4]">
            Ctrl K
          </kbd>
        </button>

        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Global search"
          className="flex sm:hidden h-9 w-9 items-center justify-center rounded-lg border border-[#E5E9E3] bg-white text-[#66736A] dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#9EADA4] cursor-pointer"
        >
          <Search className="h-4 w-4" />
        </button>

        <Button
          size="sm"
          onClick={() => openTransactionDrawer(null)}
          leftIcon={<Plus className="h-3.5 w-3.5" />}
          className="hidden md:inline-flex"
        >
          Add Transaction
        </Button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E9E3] bg-white text-[#66736A] transition-colors hover:text-[#18231E] dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#9EADA4] dark:hover:text-[#EDF2EE] cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => navigate('/notifications')}
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E9E3] bg-white text-[#66736A] transition-colors hover:text-[#18231E] dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#9EADA4] dark:hover:text-[#EDF2EE] cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-[#D97757]" />
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => navigate('/settings')}
          title={profile.name}
          className="flex h-9 items-center gap-2 rounded-lg border border-[#E5E9E3] bg-white pl-1.5 pr-2.5 text-left transition-colors hover:bg-[#EEF1EC] dark:border-[#24332C] dark:bg-[#151E1A] dark:hover:bg-[#1C2722] cursor-pointer"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#153D32] text-[11px] font-semibold text-[#F7F8F5]">
            {initials || 'A'}
          </span>
          <span className="hidden xl:block text-xs font-medium text-[#18231E] dark:text-[#EDF2EE]">
            {profile.name.split(' ')[0]}
          </span>
        </button>

        {authMode === 'backend' ? (
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E9E3] bg-white text-[#66736A] transition-colors hover:text-[#D9534F] dark:border-[#24332C] dark:bg-[#151E1A] dark:text-[#9EADA4] cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </header>
  );
}
