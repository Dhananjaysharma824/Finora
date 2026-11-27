import { PrismaClient, CategoryType, AccountType, TransactionType, RecurringFrequency } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashDemoPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 32).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

const DEFAULT_CATEGORIES: Array<{
  slug: string;
  name: string;
  type: CategoryType;
  color: string;
}> = [
  { slug: 'salary', name: 'Salary', type: 'INCOME', color: '#153D32' },
  { slug: 'freelance', name: 'Freelance', type: 'INCOME', color: '#2F765B' },
  { slug: 'investments', name: 'Investments', type: 'INCOME', color: '#D8A85D' },
  { slug: 'other_income', name: 'Other Income', type: 'INCOME', color: '#4F8F77' },
  { slug: 'food', name: 'Food & Dining', type: 'EXPENSE', color: '#2F765B' },
  { slug: 'housing', name: 'Housing', type: 'EXPENSE', color: '#153D32' },
  { slug: 'transportation', name: 'Transportation', type: 'EXPENSE', color: '#D8A85D' },
  { slug: 'shopping', name: 'Shopping', type: 'EXPENSE', color: '#D97757' },
  { slug: 'utilities', name: 'Utilities', type: 'EXPENSE', color: '#4E7A69' },
  { slug: 'entertainment', name: 'Entertainment', type: 'EXPENSE', color: '#B8893D' },
  { slug: 'healthcare', name: 'Healthcare', type: 'EXPENSE', color: '#D9534F' },
  { slug: 'education', name: 'Education', type: 'EXPENSE', color: '#3A6B58' },
  { slug: 'other', name: 'Other', type: 'EXPENSE', color: '#66736A' },
  { slug: 'transfer', name: 'Internal Transfer', type: 'TRANSFER', color: '#66736A' },
];

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development seed script must not run in production');
  }

  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findFirst({
      where: { slug: cat.slug, userId: null, isDefault: true },
    });
    if (!existing) {
      await prisma.category.create({
        data: {
          slug: cat.slug,
          name: cat.name,
          type: cat.type,
          color: cat.color,
          isDefault: true,
          userId: null,
        },
      });
    }
  }

  const demoEmail = 'alex.demo@finora.local';
  let user = await prisma.user.findUnique({ where: { email: demoEmail } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: demoEmail,
        name: 'Alex Sharma',
        passwordHash: hashDemoPassword('DemoPass!2026'),
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  }

  const existingAccounts = await prisma.account.count({ where: { userId: user.id } });
  if (existingAccounts === 0) {
    const mainBank = await prisma.account.create({
      data: {
        userId: user.id,
        name: 'Main Bank Account',
        type: AccountType.BANK,
        openingBalance: 14500.0,
        institution: 'HDFC Bank',
        lastFour: '4829',
        color: '#153D32',
      },
    });

    const savingsAcc = await prisma.account.create({
      data: {
        userId: user.id,
        name: 'Savings Account',
        type: AccountType.SAVINGS,
        openingBalance: 26000.0,
        institution: 'SBI Savings',
        lastFour: '9104',
        color: '#2F765B',
      },
    });

    const salaryCat = await prisma.category.findFirstOrThrow({
      where: { slug: 'salary', isDefault: true },
    });
    const foodCat = await prisma.category.findFirstOrThrow({
      where: { slug: 'food', isDefault: true },
    });
    const utilitiesCat = await prisma.category.findFirstOrThrow({
      where: { slug: 'utilities', isDefault: true },
    });

    const now = new Date();
    const monthKey = now.toISOString().slice(0, 7);

    await prisma.transaction.createMany({
      data: [
        {
          userId: user.id,
          accountId: mainBank.id,
          categoryId: salaryCat.id,
          title: 'Monthly Salary',
          amount: 45000.0,
          type: TransactionType.INCOME,
          date: new Date(`${monthKey}-01T09:00:00Z`),
        },
        {
          userId: user.id,
          accountId: mainBank.id,
          categoryId: foodCat.id,
          title: 'Grocery Shopping',
          amount: 2450.0,
          type: TransactionType.EXPENSE,
          date: new Date(`${monthKey}-05T14:00:00Z`),
        },
      ],
    });

    await prisma.budget.create({
      data: {
        userId: user.id,
        categoryId: foodCat.id,
        limitAmount: 6000.0,
        month: monthKey,
        description: 'Groceries & dining',
      },
    });

    await prisma.savingsGoal.create({
      data: {
        userId: user.id,
        linkedAccountId: savingsAcc.id,
        title: 'Emergency Fund',
        targetAmount: 50000.0,
        currentAmount: 38500.0,
        deadline: new Date(now.getTime() + 75 * 86400000),
      },
    });

    await prisma.recurringPayment.create({
      data: {
        userId: user.id,
        accountId: mainBank.id,
        categoryId: utilitiesCat.id,
        title: 'Fiber Internet',
        amount: 799.0,
        frequency: RecurringFrequency.MONTHLY,
        nextPaymentDate: new Date(now.getTime() + 7 * 86400000),
        isActive: true,
      },
    });
  }
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
