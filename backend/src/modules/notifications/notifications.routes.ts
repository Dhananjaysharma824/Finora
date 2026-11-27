import { Router } from 'express';
import { prisma } from '../../config/database.js';
import { authenticateUser, csrfProtection } from '../../middleware/auth.js';
import { AppError } from '../../utils/AppError.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticateUser);

notificationsRouter.get('/', async (req, res, next) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.status(200).json({ notifications });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.patch('/:id/read', csrfProtection, async (req, res, next) => {
  try {
    const existing = await prisma.notification.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
    });
    if (!existing) {
      throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }
    const updated = await prisma.notification.update({
      where: { id: existing.id },
      data: { isRead: true },
    });
    res.status(200).json({ notification: updated });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/read-all', csrfProtection, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.id, isRead: false },
      data: { isRead: true },
    });
    res.status(200).json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.delete('/:id', csrfProtection, async (req, res, next) => {
  try {
    const existing = await prisma.notification.findFirst({
      where: { id: String(req.params.id), userId: req.user!.id },
    });
    if (!existing) {
      throw new AppError('Notification not found', 404, 'NOTIFICATION_NOT_FOUND');
    }
    await prisma.notification.delete({ where: { id: existing.id } });
    res.status(200).json({ message: 'Notification deleted' });
  } catch (err) {
    next(err);
  }
});
