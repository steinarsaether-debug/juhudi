/**
 * Admin Controller – user management, branch management, audit log, LO location pings.
 * Access: ADMIN (full), BRANCH_MANAGER (read-only / own branch only).
 */
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';
import { logger } from '../utils/logger';

// ── helpers ───────────────────────────────────────────────────────────────────

function requireAdmin(req: Request): void {
  if (!req.user || req.user.role !== 'ADMIN') throw new AppError(403, 'Admin access required');
}

function requireAdminOrBM(req: Request): void {
  if (!req.user || !['ADMIN', 'BRANCH_MANAGER'].includes(req.user.role)) {
    throw new AppError(403, 'Admin or Branch Manager access required');
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function generateEmployeeId(role: string): Promise<string> {
  const prefix =
    role === 'ADMIN' ? 'ADM' :
    role === 'BRANCH_MANAGER' ? 'BM' :
    role === 'SUPERVISOR' ? 'SUP' : 'LO';
  const year = new Date().getFullYear().toString().slice(-2);
  const count = await prisma.user.count({ where: { role: role as never } });
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════════

export async function listUsers(req: Request, res: Response): Promise<void> {
  requireAdminOrBM(req);

  const {
    search, role, branchId, isActive,
    page = '1', limit = '30',
  } = req.query as Record<string, string | undefined>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  // BMs see only their own branch
  if (req.user!.role === 'BRANCH_MANAGER') {
    where.branchId = req.user!.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName:  { contains: search, mode: 'insensitive' } },
      { email:     { contains: search, mode: 'insensitive' } },
      { employeeId: { contains: search, mode: 'insensitive' } },
    ];
  }

  const pageNum  = Math.max(1, parseInt(page ?? '1'));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? '30')));
  const skip     = (pageNum - 1) * limitNum;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, phone: true, employeeId: true,
        branchId: true, branch: { select: { id: true, name: true, code: true } },
        isActive: true, lastLogin: true, mustChangePass: true, createdAt: true,
        _count: { select: { loanApplications: true } },
      },
      orderBy: [{ isActive: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      skip,
      take: limitNum,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({
    data: users,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
}

const createUserSchema = z.object({
  email:      z.string().email(),
  firstName:  z.string().min(1).max(80),
  lastName:   z.string().min(1).max(80),
  phone:      z.string().regex(/^(\+254|0)[17]\d{8}$/, 'Invalid Kenyan mobile number'),
  role:       z.enum(['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'LOAN_OFFICER']),
  branchId:   z.string().uuid().optional(),
  employeeId: z.string().max(40).optional(),
});

export async function createUser(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const body = createUserSchema.parse(req.body);

  const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
  if (existing) throw new AppError(409, 'Email already registered');

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      ...body,
      email: body.email.toLowerCase(),
      passwordHash,
      mustChangePass: true,
      employeeId: body.employeeId ?? await generateEmployeeId(body.role),
    },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, phone: true, employeeId: true,
      branchId: true, branch: { select: { id: true, name: true } },
      isActive: true, createdAt: true,
    },
  });

  await writeAuditLog(req.user!.sub, 'CREATE_USER', 'users', user.id, req);
  logger.info(`Admin created user: ${user.email}`, { adminId: req.user!.sub, userId: user.id });

  res.status(201).json({ user, temporaryPassword: tempPassword });
}

const updateUserSchema = z.object({
  firstName:  z.string().min(1).max(80).optional(),
  lastName:   z.string().min(1).max(80).optional(),
  phone:      z.string().regex(/^(\+254|0)[17]\d{8}$/).optional(),
  role:       z.enum(['ADMIN', 'BRANCH_MANAGER', 'SUPERVISOR', 'LOAN_OFFICER']).optional(),
  branchId:   z.string().uuid().nullable().optional(),
  employeeId: z.string().max(40).nullable().optional(),
});

export async function updateUser(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const { id } = req.params;
  const body = updateUserSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError(404, 'User not found');

  const updated = await prisma.user.update({
    where: { id },
    data: body,
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, phone: true, employeeId: true,
      branchId: true, branch: { select: { id: true, name: true } },
      isActive: true, updatedAt: true,
    },
  });

  await writeAuditLog(req.user!.sub, 'UPDATE_USER', 'users', id, req);
  res.json(updated);
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const { id } = req.params;

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, isActive: true } });
  if (!user) throw new AppError(404, 'User not found');

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePass: true },
  });

  await writeAuditLog(req.user!.sub, 'RESET_PASSWORD', 'users', id, req);
  logger.info(`Admin reset password for user: ${user.email}`, { adminId: req.user!.sub });

  res.json({ message: 'Password reset. User must change on next login.', temporaryPassword: tempPassword });
}

export async function toggleUserActive(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const { id } = req.params;

  // Prevent self-deactivation
  if (id === req.user!.sub) throw new AppError(400, 'You cannot deactivate your own account');

  const user = await prisma.user.findUnique({ where: { id }, select: { isActive: true } });
  if (!user) throw new AppError(404, 'User not found');

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: { id: true, isActive: true, firstName: true, lastName: true },
  });

  await writeAuditLog(req.user!.sub, updated.isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'users', id, req);
  res.json(updated);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BRANCHES
// ═══════════════════════════════════════════════════════════════════════════════

export async function listBranches(req: Request, res: Response): Promise<void> {
  requireAdminOrBM(req);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (req.user!.role === 'BRANCH_MANAGER' && req.user!.branchId) {
    where.id = req.user!.branchId;
  }

  const branches = await prisma.branch.findMany({
    where,
    include: {
      _count: {
        select: {
          users:     { where: { isActive: true } },
          customers: { where: { isActive: true } },
        },
      },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  res.json(branches);
}

const branchSchema = z.object({
  name:    z.string().min(2).max(100),
  code:    z.string().min(2).max(10).toUpperCase(),
  county:  z.string().min(2).max(60),
  address: z.string().min(5).max(200),
});

export async function createBranch(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const body = branchSchema.parse(req.body);

  const existing = await prisma.branch.findUnique({ where: { code: body.code } });
  if (existing) throw new AppError(409, `Branch code "${body.code}" already in use`);

  const branch = await prisma.branch.create({ data: body });
  await writeAuditLog(req.user!.sub, 'CREATE_BRANCH', 'branches', branch.id, req);
  res.status(201).json(branch);
}

const updateBranchSchema = z.object({
  name:    z.string().min(2).max(100).optional(),
  county:  z.string().min(2).max(60).optional(),
  address: z.string().min(5).max(200).optional(),
});

export async function updateBranch(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const { id } = req.params;
  const body = updateBranchSchema.parse(req.body);

  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) throw new AppError(404, 'Branch not found');

  const updated = await prisma.branch.update({ where: { id }, data: body });
  await writeAuditLog(req.user!.sub, 'UPDATE_BRANCH', 'branches', id, req);
  res.json(updated);
}

export async function toggleBranchActive(req: Request, res: Response): Promise<void> {
  requireAdmin(req);
  const { id } = req.params;

  const branch = await prisma.branch.findUnique({ where: { id }, select: { isActive: true } });
  if (!branch) throw new AppError(404, 'Branch not found');

  const updated = await prisma.branch.update({
    where: { id },
    data: { isActive: !branch.isActive },
    select: { id: true, isActive: true, name: true },
  });

  await writeAuditLog(req.user!.sub, updated.isActive ? 'ACTIVATE_BRANCH' : 'DEACTIVATE_BRANCH', 'branches', id, req);
  res.json(updated);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════════════════════════

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  requireAdminOrBM(req);

  const {
    userId, action, entity,
    from, to,
    page = '1', limit = '50',
  } = req.query as Record<string, string | undefined>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (action) where.action = { contains: action, mode: 'insensitive' };
  if (entity) where.entity = entity;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to)   where.createdAt.lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  // BM: scope to their branch's users
  if (req.user!.role === 'BRANCH_MANAGER' && req.user!.branchId) {
    const branchUserIds = (
      await prisma.user.findMany({
        where: { branchId: req.user!.branchId },
        select: { id: true },
      })
    ).map(u => u.id);
    where.userId = userId ? userId : { in: branchUserIds };
  } else if (userId) {
    where.userId = userId;
  }

  const pageNum  = Math.max(1, parseInt(page ?? '1'));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit ?? '50')));
  const skip     = (pageNum - 1) * limitNum;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, role: true,
            branch: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    data: logs,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LO LOCATION PINGS
// ═══════════════════════════════════════════════════════════════════════════════

export async function submitLocationPing(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Unauthorized');

  const { latitude, longitude, accuracy, activity } = req.body;
  if (!latitude || !longitude) throw new AppError(400, 'latitude and longitude are required');

  const ping = await prisma.locationPing.create({
    data: {
      userId:    req.user.sub,
      latitude:  parseFloat(String(latitude)),
      longitude: parseFloat(String(longitude)),
      accuracy:  accuracy ? parseFloat(String(accuracy)) : undefined,
      activity:  activity as string | undefined,
    },
  });

  res.status(201).json(ping);
}

export async function getLocationPings(req: Request, res: Response): Promise<void> {
  requireAdminOrBM(req);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loWhere: Record<string, any> = { role: 'LOAN_OFFICER', isActive: true };
  if (req.user!.role === 'BRANCH_MANAGER' && req.user!.branchId) {
    loWhere.branchId = req.user!.branchId;
  }

  const officers = await prisma.user.findMany({
    where: loWhere,
    select: {
      id: true, firstName: true, lastName: true,
      branch: { select: { id: true, name: true } },
      locationPings: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { latitude: true, longitude: true, accuracy: true, activity: true, createdAt: true },
      },
    },
    orderBy: [{ branch: { name: 'asc' } }, { lastName: 'asc' }],
  });

  const result = officers.map(o => ({
    userId:   o.id,
    name:     `${o.firstName} ${o.lastName}`,
    branch:   o.branch?.name ?? '—',
    branchId: o.branch?.id,
    lastPing: o.locationPings[0] ?? null,
  }));

  res.json(result);
}

// ═══════════════════════════════════════════════════════════════════════════════
// M-PESA ANALYSIS MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

export async function listMpesaAnalyses(req: Request, res: Response): Promise<void> {
  requireAdminOrBM(req);

  const {
    riskLevel, status, branchId,
    from, to,
    page = '1', limit = '50',
  } = req.query as Record<string, string | undefined>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (riskLevel) where.overallRiskLevel = riskLevel;
  if (status)    where.analysisStatus   = status;

  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to)   where.createdAt.lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  // BM: scope to their branch's customers
  const scopedBranchId = req.user!.role === 'BRANCH_MANAGER' ? req.user!.branchId : (branchId ?? undefined);
  if (scopedBranchId) {
    where.customer = { branchId: scopedBranchId };
  }

  const pageNum  = Math.max(1, parseInt(page ?? '1'));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit ?? '50')));
  const skip     = (pageNum - 1) * limitNum;

  const [statements, total] = await Promise.all([
    prisma.mpesaStatement.findMany({
      where,
      select: {
        id: true, fileName: true, sizeBytes: true,
        periodStart: true, periodEnd: true, transactionCount: true,
        analysisStatus: true, analysisError: true, analysedAt: true,
        overallRiskLevel: true, recommendedAction: true, riskSummary: true,
        avgMonthlyInflow: true, avgMonthlyOutflow: true, avgMonthlyNet: true,
        fulizaUsageCount: true, createdAt: true,
        customer: {
          select: {
            id: true, firstName: true, lastName: true,
            branch: { select: { id: true, name: true } },
          },
        },
        uploadedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.mpesaStatement.count({ where }),
  ]);

  // Aggregate stats for the filtered set (all pages)
  const stats = await prisma.mpesaStatement.groupBy({
    by: ['overallRiskLevel'],
    where: { ...where, analysisStatus: 'COMPLETE' },
    _count: { _all: true },
  });

  const riskBreakdown = Object.fromEntries(stats.map(s => [s.overallRiskLevel, s._count._all]));

  res.json({
    data: statements,
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    riskBreakdown,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM CONFIG (AI PROMPT + OTHER TUNABLE SETTINGS)
// ═══════════════════════════════════════════════════════════════════════════════

export async function getSystemConfig(req: Request, res: Response): Promise<void> {
  requireAdmin(req);

  const { key } = req.params;
  if (!key) throw new AppError(400, 'Config key is required');

  const config = await prisma.systemConfig.findUnique({
    where: { key },
    include: { updatedBy: { select: { firstName: true, lastName: true } } },
  });

  res.json(config ?? null);
}

const systemConfigSchema = z.object({
  value:       z.string().min(1, 'Value cannot be empty').max(50_000, 'Value too long'),
  description: z.string().max(500).optional(),
});

export async function upsertSystemConfig(req: Request, res: Response): Promise<void> {
  requireAdmin(req);

  const { key } = req.params;
  if (!key) throw new AppError(400, 'Config key is required');

  // Whitelist allowed config keys
  const allowedKeys = ['mpesa_analysis_prompt'];
  if (!allowedKeys.includes(key)) {
    throw new AppError(400, `Config key '${key}' is not allowed. Allowed keys: ${allowedKeys.join(', ')}`);
  }

  const body = systemConfigSchema.safeParse(req.body);
  if (!body.success) throw new AppError(400, body.error.errors[0]?.message ?? 'Validation failed');

  const config = await prisma.systemConfig.upsert({
    where:  { key },
    create: { key, value: body.data.value, description: body.data.description, updatedById: req.user!.sub, category: 'general', label: key },
    update: { value: body.data.value, description: body.data.description, updatedById: req.user!.sub },
    include: { updatedBy: { select: { firstName: true, lastName: true } } },
  });

  await writeAuditLog(req.user!.sub, 'UPDATE_SYSTEM_CONFIG', 'system_configs', config.id, req);
  logger.info(`System config '${key}' updated by ${req.user!.sub}`);

  res.json(config);
}

export async function deleteSystemConfig(req: Request, res: Response): Promise<void> {
  requireAdmin(req);

  const { key } = req.params;
  const config = await prisma.systemConfig.findUnique({ where: { key }, select: { id: true } });
  if (!config) throw new AppError(404, `Config key '${key}' not found`);

  await prisma.systemConfig.delete({ where: { key } });
  await writeAuditLog(req.user!.sub, 'DELETE_SYSTEM_CONFIG', 'system_configs', config.id, req);

  res.json({ message: 'Config deleted (reverted to default)' });
}
