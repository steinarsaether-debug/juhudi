import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../config/database';
import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;       // user id
  email: string;
  role: UserRole;
  branchId: string | null;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else {
      res.status(401).json({ error: 'Invalid token' });
    }
  }
}

/** Require one of the specified roles. */
export function authorize(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

/** Check user is not suspended (DB check on sensitive routes). */
export async function requireActiveUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ error: 'Authentication required' }); return; }
  const user = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { isActive: true } });
  if (!user?.isActive) {
    res.status(403).json({ error: 'Account is deactivated' });
    return;
  }
  next();
}
