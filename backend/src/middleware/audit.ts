/**
 * Audit Logging Middleware
 * Kenya Data Protection Act 2019 s.41 requires records of processing activities.
 * All access to personal data must be logged.
 */
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

interface AuditOptions {
  action: string;
  entity: string;
  getEntityId?: (req: Request) => string;
}

export function auditLog(opts: AuditOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Run after response
    const originalSend = res.json.bind(res);
    res.json = (body: unknown) => {
      // Only log if successful (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        const entityId = opts.getEntityId ? opts.getEntityId(req) : (req.params.id ?? 'unknown');
        prisma.auditLog.create({
          data: {
            userId: req.user.sub,
            action: opts.action,
            entity: opts.entity,
            entityId,
            ipAddress: req.ip ?? 'unknown',
            userAgent: req.headers['user-agent'] ?? 'unknown',
          },
        }).catch(err => logger.error('Failed to write audit log', { err }));
      }
      return originalSend(body);
    };
    next();
  };
}

/** Write a direct audit entry (for use in controllers). */
export async function writeAuditLog(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  req: Request,
  changes?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        changes: changes ? (changes as Prisma.InputJsonValue) : undefined,
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? 'unknown',
      },
    });
  } catch (err) {
    logger.error('Failed to write audit log', { err, userId, action, entity, entityId });
  }
}
