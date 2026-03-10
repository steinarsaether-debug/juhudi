import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';
import { logger } from '../utils/logger';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/\d/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
});

function signToken(userId: string, email: string, role: string, branchId: string | null): string {
  // JWT library type definitions require StringValue from `ms` — cast required for plain string env var
  return jwt.sign(
    { sub: userId, email, role, branchId },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRES_IN as unknown as number },
  );
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase() },
    select: {
      id: true, email: true, passwordHash: true, role: true,
      branchId: true, isActive: true, mustChangePass: true,
      firstName: true, lastName: true,
    },
  });

  if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
    // Use same error for both to prevent user enumeration
    throw new AppError(401, 'Invalid email or password');
  }

  if (!user.isActive) {
    throw new AppError(403, 'Account is deactivated. Contact your administrator.');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
  await writeAuditLog(user.id, 'LOGIN', 'users', user.id, req);

  const token = signToken(user.id, user.email, user.role, user.branchId);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      branchId: user.branchId,
      mustChangePass: user.mustChangePass,
    },
  });
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const body = changePasswordSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: { passwordHash: true },
  });
  if (!user) throw new AppError(404, 'User not found');

  const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
  if (!valid) throw new AppError(400, 'Current password is incorrect');

  const newHash = await bcrypt.hash(body.newPassword, 12);
  await prisma.user.update({
    where: { id: req.user.sub },
    data: { passwordHash: newHash, mustChangePass: false },
  });

  await writeAuditLog(req.user.sub, 'CHANGE_PASSWORD', 'users', req.user.sub, req);
  res.json({ message: 'Password updated successfully' });
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const user = await prisma.user.findUnique({
    where: { id: req.user.sub },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, phone: true, employeeId: true, branchId: true,
      branch: { select: { name: true, county: true } },
      lastLogin: true,
    },
  });
  if (!user) throw new AppError(404, 'User not found');
  res.json(user);
}

// Admin-only: create a new user
const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().regex(/^(\+254|0)[17]\d{8}$/, 'Invalid Kenyan phone number'),
  role: z.enum(['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'LOAN_OFFICER']),
  branchId: z.string().uuid().optional(),
  employeeId: z.string().optional(),
});

export async function createUser(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const body = createUserSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (existing) throw new AppError(409, 'Email already registered');

  // Temporary password – user must change on first login
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      ...body,
      email: body.email.toLowerCase(),
      passwordHash,
      mustChangePass: true,
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  await writeAuditLog(req.user.sub, 'CREATE_USER', 'users', user.id, req);

  // In production, send tempPassword via secure channel (SMS/email)
  logger.info(`New user created: ${user.email}`, { userId: user.id });

  res.status(201).json({
    user,
    temporaryPassword: config.NODE_ENV === 'development' ? tempPassword : '[sent via secure channel]',
  });
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
