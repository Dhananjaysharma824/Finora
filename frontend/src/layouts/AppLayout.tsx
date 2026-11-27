import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CreditCard, LayoutDashboard, PiggyBank, Plus, Target } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { TransactionDrawer } from '@/components/forms/TransactionDrawer';
import { CommandPalette } from '@/components/common/CommandPalette';
import { useFinoraStore } from '@/stores/useFinoraStore';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const openTransactionDrawer = useFinoraStore((s) => s.openTransactionDrawer);

  return (
    <div className="flex min-h-screen bg-[#F7F8F5] text-[#18231E] dark:bg-[#0E1512] dark:text-[#EDF2EE]">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
          <div className="mx-auto max-w-[1380px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation bar */}
      <nav
        aria-label="Mobile quick navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-[#E5E9E3] bg-white/95 px-2 backdrop-blur-md lg:hidden dark:border-[#24332C] dark:bg-[#151E1A]/95"
      >
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium',
              isActive ? 'text-[#153D32] dark:text-[#7FD1AE]' : 'text-[#66736A] dark:text-[#9EADA4]',
            )
          }
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Home</span>
        </NavLink>
        <NavLink
          to="/transactions"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium',
              isActive ? 'text-[#153D32] dark:text-[#7FD1AE]' : 'text-[#66736A] dark:text-[#9EADA4]',
            )
          }
        >
          <CreditCard className="h-4 w-4" />
          <span>Activity</span>
        </NavLink>
        <button
          type="button"
          onClick={() => openTransactionDrawer(null)}
          aria-label="Add transaction"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-[#153D32] text-white shadow-md dark:bg-[#2F765B] cursor-pointer"
        >
          <Plus className="h-5 w-5" />
        </button>
        <NavLink
          to="/budgets"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium',
              isActive ? 'text-[#153D32] dark:text-[#7FD1AE]' : 'text-[#66736A] dark:text-[#9EADA4]',
            )
          }
        >
          <PiggyBank className="h-4 w-4" />
          <span>Budgets</span>
        </NavLink>
        <NavLink
          to="/goals"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium',
              isActive ? 'text-[#153D32] dark:text-[#7FD1AE]' : 'text-[#66736A] dark:text-[#9EADA4]',
            )
          }
        >
          <Target className="h-4 w-4" />
          <span>Goals</span>
        </NavLink>
      </nav>

      <TransactionDrawer />
      <CommandPalette />
    </div>
  );
}
