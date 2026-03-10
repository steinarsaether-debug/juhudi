import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.sub },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json(notifications);
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const count = await prisma.notification.count({
    where: { userId: req.user.sub, isRead: false },
  });

  res.json({ count });
});

const markReadSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1) }),
  z.object({ all: z.literal(true) }),
]);

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const body = markReadSchema.parse(req.body);

  if ('all' in body) {
    await prisma.notification.updateMany({
      where: { userId: req.user.sub, isRead: false },
      data: { isRead: true },
    });
  } else {
    await prisma.notification.updateMany({
      where: { userId: req.user.sub, id: { in: body.ids } },
      data: { isRead: true },
    });
  }

  res.json({ success: true });
});
