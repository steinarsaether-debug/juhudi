import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { asyncHandler } from '../utils/asyncHandler';
import { writeAuditLog } from '../middleware/audit';
import {
  findNameDuplicates,
  runCustomerChecks,
  runApplicationChecks,
  runAllChecksForApplication,
  getBranchQualityReport,
} from '../services/qualityService';

// ─── Pre-check: name duplicate (called live from onboarding form) ─────────────

export const checkNameDuplicate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const schema = z.object({
    firstName:       z.string().min(1),
    lastName:        z.string().min(1),
    dateOfBirth:     z.string().datetime({ offset: true }).optional(),
    excludeCustomerId: z.string().uuid().optional(),
  });
  const { firstName, lastName, dateOfBirth, excludeCustomerId } = schema.parse(req.query);

  const dob = dateOfBirth ? new Date(dateOfBirth) : null;
  const matches = await findNameDuplicates(firstName, lastName, dob, excludeCustomerId);

  res.json({ matches });
});

// ─── Trigger customer scan ────────────────────────────────────────────────────

export const scanCustomer = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;
  const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!customer) throw new AppError(404, 'Customer not found');
  // Run async (don't await) for large deployments; await here for immediate feedback
  await runCustomerChecks(id);
  const flags = await prisma.dataQualityFlag.findMany({
    where: { entityType: 'CUSTOMER', entityId: id, isResolved: false },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({ flags });
});

// ─── Trigger application scan ─────────────────────────────────────────────────

export const scanApplication = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;
  const app = await prisma.loanApplication.findUnique({ where: { id }, select: { id: true } });
  if (!app) throw new AppError(404, 'Application not found');
  await runAllChecksForApplication(id);
  const flags = await prisma.dataQualityFlag.findMany({
    where: { entityType: 'LOAN_APPLICATION', entityId: id, isResolved: false },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({ flags });
});

// ─── Get flags for an entity ──────────────────────────────────────────────────

export const getFlags = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { entityType, entityId } = req.params;

  const flags = await prisma.dataQualityFlag.findMany({
    where: { entityType, entityId },
    orderBy: [{ isResolved: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
    include: {
      resolvedBy: { select: { firstName: true, lastName: true } },
    },
  });
  res.json({ flags });
});

// ─── Resolve / dismiss a flag ─────────────────────────────────────────────────

export const resolveFlag = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { flagId } = req.params;
  const schema = z.object({ resolvedNote: z.string().max(500).optional() });
  const { resolvedNote } = schema.parse(req.body);

  const flag = await prisma.dataQualityFlag.findUnique({ where: { id: flagId } });
  if (!flag) throw new AppError(404, 'Flag not found');

  const updated = await prisma.dataQualityFlag.update({
    where: { id: flagId },
    data: {
      isResolved: true,
      resolvedById: req.user.sub,
      resolvedAt: new Date(),
      resolvedNote: resolvedNote ?? 'Dismissed by reviewer',
    },
  });
  await writeAuditLog(req.user.sub, 'RESOLVE_QUALITY_FLAG', 'data_quality_flags', flagId, req, {
    flagType: flag.flagType,
    entityType: flag.entityType,
    entityId: flag.entityId,
    resolvedNote,
  });
  res.json(updated);
});

// ─── Branch quality report ────────────────────────────────────────────────────

export const qualityReport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const dbUser = await prisma.user.findUnique({ where: { id: req.user.sub } });
  const branchId = dbUser?.branchId ?? null;
  const report = await getBranchQualityReport(branchId);
  res.json(report);
});

// ─── Full scan: all customers/applications in a branch ───────────────────────
// For an admin/BM to run a one-time sweep.

export const runBranchScan = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  if (!['BRANCH_MANAGER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError(403, 'Branch Manager or Admin only');
  }

  const dbUser = await prisma.user.findUnique({ where: { id: req.user.sub } });
  const branchId = dbUser?.branchId ?? undefined;

  const customers = await prisma.customer.findMany({
    where: { isActive: true, ...(branchId ? { branchId } : {}) },
    select: { id: true },
  });
  const applications = await prisma.loanApplication.findMany({
    where: { ...(branchId ? { customer: { branchId } } : {}) },
    select: { id: true },
  });

  // Run in serial batches of 20 to avoid DB overload
  const BATCH = 20;
  for (let i = 0; i < customers.length; i += BATCH) {
    await Promise.all(customers.slice(i, i + BATCH).map(c => runCustomerChecks(c.id)));
  }
  for (let i = 0; i < applications.length; i += BATCH) {
    await Promise.all(applications.slice(i, i + BATCH).map(a => runApplicationChecks(a.id)));
  }

  res.json({
    scanned: { customers: customers.length, applications: applications.length },
    message: 'Scan complete. Check /quality/report for results.',
  });
  await writeAuditLog(req.user.sub, 'RUN_BRANCH_QUALITY_SCAN', 'data_quality_flags', branchId ?? 'all', req, {
    customersScanned: customers.length,
    applicationsScanned: applications.length,
  });
});
