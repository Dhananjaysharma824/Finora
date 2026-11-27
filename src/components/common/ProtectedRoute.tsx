import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';

export function ProtectedRoute() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isCheckingAuth = useAuthStore((s) => s.isCheckingAuth);
  const authMode = useAuthStore((s) => s.authMode);

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F8F5] dark:bg-[#0E1512]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#153D32] border-t-transparent dark:border-[#3D9473]" />
      </div>
    );
  }

  if (authMode === 'backend' && !isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
