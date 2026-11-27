import { prisma } from '../../config/database.js';
import { AppError } from '../../utils/AppError.js';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export const categoriesService = {
  async list(userId: string) {
    return prisma.category.findMany({
      where: {
        OR: [{ userId }, { isDefault: true, userId: null }],
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  },

  async create(
    userId: string,
    input: { name: string; slug?: string; type: 'INCOME' | 'EXPENSE'; color: string },
  ) {
    const slug = input.slug ?? toSlug(input.name);
    if (!slug) {
      throw new AppError('Invalid category name', 400, 'INVALID_CATEGORY');
    }

    const existing = await prisma.category.findFirst({
      where: { userId, slug },
    });
    if (existing) {
      throw new AppError('A category with this slug already exists', 409, 'CATEGORY_EXISTS');
    }

    return prisma.category.create({
      data: {
        userId,
        name: input.name,
        slug,
        type: input.type,
        color: input.color,
        isDefault: false,
      },
    });
  },

  async update(
    userId: string,
    categoryId: string,
    input: { name?: string; color?: string },
  ) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) {
      throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }
    if (cat.isDefault || cat.userId !== userId) {
      throw new AppError('Cannot modify default or other user categories', 403, 'FORBIDDEN');
    }

    return prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });
  },

  async remove(userId: string, categoryId: string) {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) {
      throw new AppError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }
    if (cat.isDefault || cat.userId !== userId) {
      throw new AppError('Cannot delete default or other user categories', 403, 'FORBIDDEN');
    }

    const usedCount = await prisma.transaction.count({
      where: { userId, categoryId },
    });
    if (usedCount > 0) {
      throw new AppError('Category is in use by existing transactions', 409, 'CATEGORY_IN_USE');
    }

    await prisma.category.delete({ where: { id: categoryId } });
  },
};
