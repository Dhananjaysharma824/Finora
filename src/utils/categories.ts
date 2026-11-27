import type { CategoryId, ExpenseCategoryId, IncomeCategoryId, TransactionType } from '@/types/finance';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  type: TransactionType;
  color: string;
  bgTint: string;
}

export const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  // Income
  salary: {
    id: 'salary',
    label: 'Salary',
    type: 'income',
    color: '#153D32',
    bgTint: '#E5EFE8',
  },
  freelance: {
    id: 'freelance',
    label: 'Freelance',
    type: 'income',
    color: '#2F765B',
    bgTint: '#E5EFE8',
  },
  investments: {
    id: 'investments',
    label: 'Investments',
    type: 'income',
    color: '#D8A85D',
    bgTint: '#FAF3E6',
  },
  other_income: {
    id: 'other_income',
    label: 'Other Income',
    type: 'income',
    color: '#4F8F77',
    bgTint: '#E5EFE8',
  },

  // Expenses
  food: {
    id: 'food',
    label: 'Food & Dining',
    type: 'expense',
    color: '#2F765B',
    bgTint: '#E5EFE8',
  },
  housing: {
    id: 'housing',
    label: 'Housing',
    type: 'expense',
    color: '#153D32',
    bgTint: '#E5EFE8',
  },
  transportation: {
    id: 'transportation',
    label: 'Transportation',
    type: 'expense',
    color: '#D8A85D',
    bgTint: '#FAF3E6',
  },
  shopping: {
    id: 'shopping',
    label: 'Shopping',
    type: 'expense',
    color: '#D97757',
    bgTint: '#FBECE7',
  },
  utilities: {
    id: 'utilities',
    label: 'Utilities',
    type: 'expense',
    color: '#4E7A69',
    bgTint: '#E8EFEA',
  },
  entertainment: {
    id: 'entertainment',
    label: 'Entertainment',
    type: 'expense',
    color: '#B8893D',
    bgTint: '#FAF3E6',
  },
  healthcare: {
    id: 'healthcare',
    label: 'Healthcare',
    type: 'expense',
    color: '#D9534F',
    bgTint: '#FBEAEA',
  },
  education: {
    id: 'education',
    label: 'Education',
    type: 'expense',
    color: '#3A6B58',
    bgTint: '#E5EFE8',
  },
  other: {
    id: 'other',
    label: 'Other',
    type: 'expense',
    color: '#66736A',
    bgTint: '#EEF1EC',
  },

  // Transfer
  transfer: {
    id: 'transfer',
    label: 'Internal Transfer',
    type: 'transfer',
    color: '#66736A',
    bgTint: '#EEF1EC',
  },
};

export const EXPENSE_CATEGORIES: ExpenseCategoryId[] = [
  'food',
  'housing',
  'transportation',
  'shopping',
  'utilities',
  'entertainment',
  'healthcare',
  'education',
  'other',
];

export const INCOME_CATEGORIES: IncomeCategoryId[] = [
  'salary',
  'freelance',
  'investments',
  'other_income',
];

export function getCategoryMeta(id: CategoryId): CategoryMeta {
  return CATEGORIES[id] ?? CATEGORIES.other;
}
