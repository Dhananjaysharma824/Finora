import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppLayout } from '@/layouts/AppLayout';
import { ThemeManager } from '@/components/common/ThemeManager';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFinoraStore } from '@/stores/useFinoraStore';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() =>
  import('@/pages/AuthRecoveryPages').then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('@/pages/AuthRecoveryPages').then((m) => ({ default: m.ResetPasswordPage })),
);
const VerifyEmailPage = lazy(() =>
  import('@/pages/AuthRecoveryPages').then((m) => ({ default: m.VerifyEmailPage })),
);
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const BudgetsPage = lazy(() => import('@/pages/BudgetsPage'));
const GoalsPage = lazy(() => import('@/pages/GoalsPage'));
const RecurringPage = lazy(() => import('@/pages/RecurringPage'));
const AccountsPage = lazy(() => import('@/pages/AccountsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

function PageLoader() {
  return (
    <div className="space-y-4 py-4">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[#EEF1EC] dark:bg-[#1C2722]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="h-28 animate-pulse rounded-[10px] bg-[#EEF1EC] dark:bg-[#1C2722]"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-[10px] bg-[#EEF1EC] dark:bg-[#1C2722]" />
    </div>
  );
}

const PAGE_TITLES: Record<string, string> = {
  '/login': 'Sign In — Finora',
  '/register': 'Create Account — Finora',
  '/forgot-password': 'Forgot Password — Finora',
  '/reset-password': 'Reset Password — Finora',
  '/verify-email': 'Verify Email — Finora',
  '/dashboard': 'Dashboard — Finora',
  '/transactions': 'Transactions — Finora',
  '/analytics': 'Analytics — Finora',
  '/budgets': 'Budgets — Finora',
  '/goals': 'Savings Goals — Finora',
  '/recurring': 'Recurring Payments — Finora',
  '/accounts': 'Accounts — Finora',
  '/calendar': 'Calendar — Finora',
  '/reports': 'Reports — Finora',
  '/notifications': 'Notifications — Finora',
  '/settings': 'Settings — Finora',
};

function RouteMetadataManager() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = PAGE_TITLES[pathname] ?? 'Finora — Your Money. Your Clarity.';
  }, [pathname]);
  return null;
}

export function App() {
  const checkSession = useAuthStore((s) => s.checkSession);
  const authMode = useAuthStore((s) => s.authMode);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const syncFromBackend = useFinoraStore((s) => s.syncFromBackend);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (authMode === 'backend' && isAuthenticated) {
      void syncFromBackend();
    }
  }, [authMode, isAuthenticated, syncFromBackend]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <RouteMetadataManager />
        <ThemeManager />
        <Toaster position="bottom-right" richColors closeButton />
        <Routes>
          <Route
            path="/login"
            element={
              <Suspense fallback={<PageLoader />}>
                <LoginPage />
              </Suspense>
            }
          />
          <Route
            path="/register"
            element={
              <Suspense fallback={<PageLoader />}>
                <RegisterPage />
              </Suspense>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <Suspense fallback={<PageLoader />}>
                <ForgotPasswordPage />
              </Suspense>
            }
          />
          <Route
            path="/reset-password"
            element={
              <Suspense fallback={<PageLoader />}>
                <ResetPasswordPage />
              </Suspense>
            }
          />
          <Route
            path="/verify-email"
            element={
              <Suspense fallback={<PageLoader />}>
                <VerifyEmailPage />
              </Suspense>
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <Suspense fallback={<PageLoader />}>
                  <DashboardPage />
                </Suspense>
              }
            />
            <Route
              path="/transactions"
              element={
                <Suspense fallback={<PageLoader />}>
                  <TransactionsPage />
                </Suspense>
              }
            />
            <Route
              path="/analytics"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AnalyticsPage />
                </Suspense>
              }
            />
            <Route
              path="/budgets"
              element={
                <Suspense fallback={<PageLoader />}>
                  <BudgetsPage />
                </Suspense>
              }
            />
            <Route
              path="/goals"
              element={
                <Suspense fallback={<PageLoader />}>
                  <GoalsPage />
                </Suspense>
              }
            />
            <Route
              path="/recurring"
              element={
                <Suspense fallback={<PageLoader />}>
                  <RecurringPage />
                </Suspense>
              }
            />
            <Route
              path="/accounts"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AccountsPage />
                </Suspense>
              }
            />
            <Route
              path="/reports"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ReportsPage />
                </Suspense>
              }
            />
            <Route
              path="/calendar"
              element={
                <Suspense fallback={<PageLoader />}>
                  <CalendarPage />
                </Suspense>
              }
            />
            <Route
              path="/notifications"
              element={
                <Suspense fallback={<PageLoader />}>
                  <NotificationsPage />
                </Suspense>
              }
            />
            <Route
              path="/settings"
              element={
                <Suspense fallback={<PageLoader />}>
                  <SettingsPage />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
