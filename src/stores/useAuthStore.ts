import { create } from 'zustand';
import {
  finoraApi,
  isBackendConfigured,
  setUnauthorizedHandler,
  type AuthUserDto,
} from '@/services/api';

interface AuthStore {
  user: AuthUserDto | null;
  isAuthenticated: boolean;
  isCheckingAuth: boolean;
  authMode: 'backend' | 'demo';
  authError: string | null;

  checkSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<string>;
  logout: () => Promise<void>;
  enterDemoMode: () => void;
  clearAuthError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => {
  setUnauthorizedHandler(() => {
    set({
      user: null,
      isAuthenticated: false,
      authError: 'Your session expired. Please sign in again.',
    });
  });

  return {
    user: null,
    isAuthenticated: !isBackendConfigured(),
    isCheckingAuth: isBackendConfigured(),
    authMode: isBackendConfigured() ? 'backend' : 'demo',
    authError: null,

    checkSession: async () => {
      if (!isBackendConfigured()) {
        set({
          isCheckingAuth: false,
          isAuthenticated: true,
          authMode: 'demo',
        });
        return;
      }

      set({ isCheckingAuth: true });
      try {
        const { user } = await finoraApi.auth.me();
        set({
          user,
          isAuthenticated: true,
          isCheckingAuth: false,
          authMode: 'backend',
          authError: null,
        });
      } catch {
        set({
          user: null,
          isAuthenticated: false,
          isCheckingAuth: false,
          authMode: 'backend',
        });
      }
    },

    login: async (email, password) => {
      set({ authError: null });
      const { user } = await finoraApi.auth.login({ email, password });
      set({
        user,
        isAuthenticated: true,
        authMode: 'backend',
        authError: null,
      });
    },

    register: async (name, email, password) => {
      set({ authError: null });
      const res = await finoraApi.auth.register({ name, email, password });
      return res.message;
    },

    logout: async () => {
      try {
        if (isBackendConfigured()) {
          await finoraApi.auth.logout();
        }
      } finally {
        set({
          user: null,
          isAuthenticated: false,
          authError: null,
        });
      }
    },

    enterDemoMode: () => {
      set({
        isAuthenticated: true,
        authMode: 'demo',
        authError: null,
      });
    },

    clearAuthError: () => set({ authError: null }),
  };
});
