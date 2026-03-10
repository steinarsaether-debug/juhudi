/**
 * Shared helper — create in-app Notification rows for a set of user IDs.
 * Used by meetingController and bccController.
 */
import { NotificationType } from '@prisma/client';
import { prisma } from '../config/database';

export async function notifyUsers(
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string | null,
  entityType: string | null,
  entityId: string | null,
): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map(userId => ({
      userId, type, title, body, entityType, entityId,
    })),
    skipDuplicates: true,
  });
}
