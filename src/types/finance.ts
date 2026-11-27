export type TransactionType = 'income' | 'expense' | 'transfer';

export type ExpenseCategoryId =
  | 'food'
  | 'shopping'
  | 'transportation'
  | 'housing'
  | 'utilities'
  | 'entertainment'
  | 'healthcare'
  | 'education'
  | 'other';

export type IncomeCategoryId =
  | 'salary'
  | 'freelance'
  | 'investments'
  | 'other_income';

export type CategoryId = ExpenseCategoryId | IncomeCategoryId | 'transfer';

export type AccountType = 'bank' | 'savings' | 'cash' | 'wallet';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export type ThemeMode = 'light' | 'dark' | 'system';

export type DateFormatOption = 'dd MMM yyyy' | 'MM/dd/yyyy' | 'yyyy-MM-dd';

export type NumberFormatOption = 'en-IN' | 'en-US';

export type RecurringFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type NotificationType =
  | 'budget_warning'
  | 'budget_exceeded'
  | 'recurring_upcoming'
  | 'goal_milestone'
  | 'transaction_created'
  | 'transaction_updated';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalancePaise: number;
  institution?: string;
  lastFour?: string;
  color: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  title: string;
  amountPaise: number;
  type: TransactionType;
  category: CategoryId;
  accountId: string;
  toAccountId?: string;
  date: string; // ISO YYYY-MM-DD
  notes?: string;
  recurringId?: string;
  goalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  category: ExpenseCategoryId;
  limitPaise: number;
  month: string; // YYYY-MM
  description?: string;
  createdAt: string;
}

export interface SavingsGoal {
  id: string;
  title: string;
  targetPaise: number;
  currentPaise: number;
  deadline: string; // YYYY-MM-DD
  accountId?: string;
  notes?: string;
  createdAt: string;
}

export interface RecurringPayment {
  id: string;
  title: string;
  amountPaise: number;
  category: ExpenseCategoryId;
  accountId: string;
  frequency: RecurringFrequency;
  nextPaymentDate: string; // YYYY-MM-DD
  isActive: boolean;
  notes?: string;
  lastPaidDate?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  linkTo?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface UserPreferences {
  currency: CurrencyCode;
  dateFormat: DateFormatOption;
  numberFormat: NumberFormatOption;
  defaultDateRange: 'this_month' | 'last_3_months' | 'this_year';
  theme: ThemeMode;
  alerts: {
    budgetAlerts: boolean;
    paymentReminders: boolean;
    savingsMilestones: boolean;
  };
}

export interface FinoraPersistedData {
  version: number;
  profile: UserProfile;
  preferences: UserPreferences;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: SavingsGoal[];
  recurringPayments: RecurringPayment[];
  notifications: AppNotification[];
}
