import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  LayoutDashboard,
  PiggyBank,
  Repeat,
  Settings,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import { FinoraLogo } from '@/components/common/FinoraLogo';
import { cn } from '@/lib/utils';

interface NavSection {
  title: string;
  items: Array<{
    to: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }>;
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Money',
    items: [
      { to: '/transactions', label: 'Transactions', icon: CreditCard },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/budgets', label: 'Budgets', icon: PiggyBank },
      { to: '/goals', label: 'Savings Goals', icon: Target },
      { to: '/recurring', label: 'Recurring Payments', icon: Repeat },
      { to: '/accounts', label: 'Accounts', icon: Wallet },
    ],
  },
  {
    title: 'Planning',
    items: [
      { to: '/calendar', label: 'Calendar', icon: Calendar },
      { to: '/reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    title: 'Preferences',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (isMobile: boolean) => {
    const isCollapsed = !isMobile && collapsed;
    return (
      <div className="flex h-full flex-col bg-[#153D32] text-[#F7F8F5] dark:bg-[#0D261F]">
        <div
          className={cn(
            'flex h-16 items-center border-b border-white/10 px-4',
            isCollapsed ? 'justify-center' : 'justify-between',
          )}
        >
          <NavLink to="/dashboard" onClick={isMobile ? onCloseMobile : undefined}>
            <FinoraLogo collapsed={isCollapsed} />
          </NavLink>
          {isMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation"
              className="rounded-lg p-1.5 text-[#B4CBC1] hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-[#9EC0B3] transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Main navigation">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              {!isCollapsed ? (
                <div className="mb-2 px-2.5 text-[11px] font-medium text-[#84A99B]">
                  {section.title}
                </div>
              ) : null}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        title={isCollapsed ? item.label : undefined}
                        onClick={isMobile ? onCloseMobile : undefined}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors duration-150',
                            isCollapsed && 'justify-center px-0',
                            isActive
                              ? 'bg-[#102F27] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                              : 'text-[#C6DDD3] hover:bg-white/8 hover:text-white',
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive ? (
                              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[#D8A85D]" />
                            ) : null}
                            <Icon
                              className={cn(
                                'h-4 w-4 shrink-0 transition-colors',
                                isActive ? 'text-[#D8A85D]' : 'text-[#9EC0B3] group-hover:text-white',
                              )}
                            />
                            {!isCollapsed ? <span className="truncate">{item.label}</span> : null}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {!isCollapsed ? (
          <div className="border-t border-white/10 p-4">
            <div className="rounded-lg bg-[#102F27] px-3 py-2.5">
              <p className="text-[11px] font-medium text-[#D8A85D]">Local workspace</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#9EC0B3]">
                Saved locally in this browser
              </p>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside
        className={cn(
          'hidden lg:block shrink-0 transition-[width] duration-200 border-r border-[#102F27]',
          collapsed ? 'w-[76px]' : 'w-[250px]',
        )}
      >
        <div className="sticky top-0 h-screen">{navContent(false)}</div>
      </aside>

      {/* Mobile slide-over sidebar */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-[#102F27]/50 backdrop-blur-[1px]"
          />
          <aside className="relative z-10 w-[264px] max-w-[82vw] h-full shadow-2xl">
            {navContent(true)}
          </aside>
        </div>
      ) : null}
    </>
  );
}
