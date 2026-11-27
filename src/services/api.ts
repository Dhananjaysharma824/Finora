import type {
  Account,
  AppNotification,
  Budget,
  RecurringPayment,
  SavingsGoal,
  Transaction,
  UserPreferences,
  UserProfile,
} from '@/types/finance';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
  skipUnauthorizedHandler?: boolean;
}

const CSRF_COOKIE_NAME = 'finora_csrf';
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return configured ? configured.replace(/\/$/, '') : '';
}

export function isBackendConfigured(): boolean {
  return Boolean(import.meta.env.VITE_API_BASE_URL);
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const parts = document.cookie.split(';').map((c) => c.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return null;
}

async function ensureCsrfToken(): Promise<string | null> {
  const existing = readCookie(CSRF_COOKIE_NAME);
  if (existing) return existing;
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/v1/auth/csrf-token`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { csrfToken?: string };
    return data.csrfToken ?? readCookie(CSRF_COOKIE_NAME);
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const { body, timeoutMs = 15_000, headers, skipUnauthorizedHandler, ...rest } = options;
  const method = (rest.method ?? 'GET').toUpperCase();
  const isMutation = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

  const csrfToken = isMutation ? await ensureCsrfToken() : null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...rest,
      method,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      if (response.status === 401 && !skipUnauthorizedHandler && unauthorizedHandler) {
        unauthorizedHandler();
      }
      let message = `Request failed (${response.status})`;
      let code: string | undefined;
      try {
        const errBody = (await response.json()) as {
          error?: { message?: string; code?: string };
          message?: string;
        };
        if (errBody.error?.message) message = errBody.error.message;
        else if (errBody.message) message = errBody.message;
        code = errBody.error?.code;
      } catch {
        // Non-JSON error body
      }
      throw new ApiError(message, response.status, code);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Request timed out', 408, 'TIMEOUT');
    }
    throw new ApiError('Unable to reach server', 0, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  theme: string;
  timezone: string;
}

export const finoraApi = {
  auth: {
    me: () =>
      apiRequest<{ user: AuthUserDto }>('/api/v1/auth/me', {
        skipUnauthorizedHandler: true,
      }),
    login: (payload: { email: string; password: string }) =>
      apiRequest<{ user: AuthUserDto; csrfToken: string }>('/api/v1/auth/login', {
        method: 'POST',
        body: payload,
        skipUnauthorizedHandler: true,
      }),
    register: (payload: { name: string; email: string; password: string }) =>
      apiRequest<{ user: AuthUserDto; message: string }>('/api/v1/auth/register', {
        method: 'POST',
        body: payload,
        skipUnauthorizedHandler: true,
      }),
    logout: () =>
      apiRequest<{ message: string }>('/api/v1/auth/logout', {
        method: 'POST',
      }),
    forgotPassword: (email: string) =>
      apiRequest<{ message: string }>('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: { email },
      }),
    resetPassword: (token: string, newPassword: string) =>
      apiRequest<{ message: string }>('/api/v1/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword },
      }),
    verifyEmail: (token: string) =>
      apiRequest<{ message: string }>('/api/v1/auth/verify-email', {
        method: 'POST',
        body: { token },
      }),
  },
  accounts: {
    list: () => apiRequest<{ accounts: Account[] }>('/api/v1/accounts'),
    create: (payload: {
      name: string;
      type: 'BANK' | 'SAVINGS' | 'CASH' | 'WALLET';
      openingBalance: number;
      institution?: string;
      lastFour?: string;
      color: string;
    }) => apiRequest<{ account: Account }>('/api/v1/accounts', { method: 'POST', body: payload }),
    update: (id: string, payload: Record<string, unknown>) =>
      apiRequest<{ account: Account }>(`/api/v1/accounts/${id}`, {
        method: 'PATCH',
        body: payload,
      }),
    archive: (id: string) =>
      apiRequest<{ message: string }>(`/api/v1/accounts/${id}`, { method: 'DELETE' }),
  },
  transactions: {
    list: (pageSize = 100) =>
      apiRequest<{ items: Transaction[]; total: number }>(
        `/api/v1/transactions?pageSize=${pageSize}`,
      ),
    create: (payload: Record<string, unknown>) =>
      apiRequest<{ transaction: Transaction }>('/api/v1/transactions', {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      apiRequest<{ transaction: Transaction }>(`/api/v1/transactions/${id}`, {
        method: 'PATCH',
        body: payload,
      }),
    remove: (id: string) =>
      apiRequest<{ message: string }>(`/api/v1/transactions/${id}`, { method: 'DELETE' }),
  },
  budgets: {
    list: (month?: string) =>
      apiRequest<{ budgets: Budget[] }>(
        month ? `/api/v1/budgets?month=${encodeURIComponent(month)}` : '/api/v1/budgets',
      ),
    create: (payload: Record<string, unknown>) =>
      apiRequest<{ budget: Budget }>('/api/v1/budgets', { method: 'POST', body: payload }),
    update: (id: string, payload: Record<string, unknown>) =>
      apiRequest<{ budget: Budget }>(`/api/v1/budgets/${id}`, {
        method: 'PATCH',
        body: payload,
      }),
    remove: (id: string) =>
      apiRequest<{ message: string }>(`/api/v1/budgets/${id}`, { method: 'DELETE' }),
  },
  goals: {
    list: () => apiRequest<{ goals: SavingsGoal[] }>('/api/v1/goals'),
    create: (payload: Record<string, unknown>) =>
      apiRequest<{ goal: SavingsGoal }>('/api/v1/goals', { method: 'POST', body: payload }),
    update: (id: string, payload: Record<string, unknown>) =>
      apiRequest<{ goal: SavingsGoal }>(`/api/v1/goals/${id}`, {
        method: 'PATCH',
        body: payload,
      }),
    remove: (id: string) =>
      apiRequest<{ message: string }>(`/api/v1/goals/${id}`, { method: 'DELETE' }),
    contribute: (goalId: string, payload: { amount: number; sourceAccountId?: string }) =>
      apiRequest<{ goal: SavingsGoal }>(`/api/v1/goals/${goalId}/contributions`, {
        method: 'POST',
        body: payload,
      }),
  },
  recurring: {
    list: () => apiRequest<{ items: RecurringPayment[] }>('/api/v1/recurring'),
    create: (payload: Record<string, unknown>) =>
      apiRequest<{ recurringPayment: RecurringPayment }>('/api/v1/recurring', {
        method: 'POST',
        body: payload,
      }),
    update: (id: string, payload: Record<string, unknown>) =>
      apiRequest<{ recurringPayment: RecurringPayment }>(`/api/v1/recurring/${id}`, {
        method: 'PATCH',
        body: payload,
      }),
    markPaid: (id: string) =>
      apiRequest<{ recurringPayment: RecurringPayment }>(`/api/v1/recurring/${id}/mark-paid`, {
        method: 'POST',
      }),
    remove: (id: string) =>
      apiRequest<{ message: string }>(`/api/v1/recurring/${id}`, { method: 'DELETE' }),
  },
  notifications: {
    list: () => apiRequest<{ notifications: AppNotification[] }>('/api/v1/notifications'),
    markRead: (id: string) =>
      apiRequest<{ notification: AppNotification }>(`/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
      }),
    markAllRead: () =>
      apiRequest<{ message: string }>('/api/v1/notifications/read-all', { method: 'POST' }),
    remove: (id: string) =>
      apiRequest<{ message: string }>(`/api/v1/notifications/${id}`, { method: 'DELETE' }),
  },
  dashboard: (month: string) =>
    apiRequest<Record<string, unknown>>(
      `/api/v1/dashboard?month=${encodeURIComponent(month)}`,
    ),
  users: {
    updateProfile: (payload: Partial<Pick<UserProfile, 'name'>>) =>
      apiRequest<{ user: AuthUserDto }>('/api/v1/users/profile', {
        method: 'PATCH',
        body: payload,
      }),
    updatePreferences: (
      payload: Partial<Pick<UserPreferences, 'currency' | 'dateFormat' | 'numberFormat' | 'theme'>>,
    ) =>
      apiRequest<{ user: AuthUserDto }>('/api/v1/users/preferences', {
        method: 'PATCH',
        body: payload,
      }),
  },
};
