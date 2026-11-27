// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/stores/useAuthStore';

describe('useAuthStore & frontend auth flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to demo mode when VITE_API_BASE_URL is not configured', async () => {
    await useAuthStore.getState().checkSession();
    const state = useAuthStore.getState();
    expect(state.authMode).toBe('demo');
    expect(state.isAuthenticated).toBe(true);
    expect(state.isCheckingAuth).toBe(false);
  });

  it('logs out cleanly without storing session tokens in localStorage', async () => {
    await useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(window.localStorage.getItem('finora_sid')).toBeNull();
    expect(window.localStorage.getItem('token')).toBeNull();
  });
});
