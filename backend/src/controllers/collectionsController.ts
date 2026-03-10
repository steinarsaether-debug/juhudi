import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';
import { asyncHandler } from '../utils/asyncHandler';

// ─── List loans in arrears ────────────────────────────────────────────────────

export const listArrears = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });

  const minDays = parseInt(req.query.minDays as string ?? '1');
  const page    = Math.max(1, parseInt(req.query.page as string ?? '1'));
  const limit   = Math.min(100, parseInt(req.query.limit as string ?? '25'));

  // Scope: LO sees loans from their applications; supervisors/BM see full branch
  const baseWhere = req.user.role === 'LOAN_OFFICER'
    ? { status: 'ACTIVE' as const, daysInArrears: { gte: minDays }, application: { officerId: req.user.sub } }
    : user?.branchId
      ? { status: 'ACTIVE' as const, daysInArrears: { gte: minDays }, customer: { branchId: user.branchId } }
      : { status: 'ACTIVE' as const, daysInArrears: { gte: minDays } };

  const [loans, total] = await Promise.all([
    prisma.loan.findMany({
      where: baseWhere,
      orderBy: [{ daysInArrears: 'desc' }, { outstandingBalKes: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: {
          select: {
            id: true, firstName: true, lastName: true,
            county: true, village: true,
          },
        },
        application: {
          select: {
            officer: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        collectionActions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            actionType: true,
            createdAt: true,
            nextActionDate: true,
            notes: true,
          },
        },
        _count: { select: { collectionActions: true } },
      },
    }),
    prisma.loan.count({ where: baseWhere }),
  ]);

  res.json({ data: loans, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

// ─── Get collection history for one loan ─────────────────────────────────────

export const getLoanCollections = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const { loanId } = req.params;

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: {
      id: true, loanNumber: true, daysInArrears: true,
      outstandingBalKes: true, status: true,
      customer: {
        select: { id: true, firstName: true, lastName: true, county: true },
      },
      application: {
        select: {
          officer: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      collectionActions: {
        orderBy: { createdAt: 'desc' },
        include: {
          performedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      },
    },
  });

  if (!loan) throw new AppError(404, 'Loan not found');
  res.json(loan);
});

// ─── Log a collection action ──────────────────────────────────────────────────

const actionSchema = z.object({
  actionType: z.enum([
    'AUTO_ALERT', 'PHONE_CALL', 'SMS_SENT', 'FIELD_VISIT',
    'PROMISE_TO_PAY', 'PARTIAL_PAYMENT', 'DEMAND_LETTER',
    'LEGAL_NOTICE', 'WRITE_OFF_RECOMMENDED', 'RESTRUCTURED', 'OTHER',
  ]),
  notes: z.string().max(2000).optional(),
  nextActionDate: z.string().datetime({ offset: true }).optional(),
  promisedAmountKes: z.number().min(0).optional(),
  promisedDate: z.string().datetime({ offset: true }).optional(),
});

export const logAction = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const { loanId } = req.params;
  const body = actionSchema.parse(req.body);

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: { id: true, daysInArrears: true, outstandingBalKes: true },
  });
  if (!loan) throw new AppError(404, 'Loan not found');

  const action = await prisma.collectionAction.create({
    data: {
      loanId,
      performedById: req.user.sub,
      daysInArrears: loan.daysInArrears,
      outstandingKes: loan.outstandingBalKes ?? 0,
      actionType: body.actionType,
      notes: body.notes,
      nextActionDate: body.nextActionDate ? new Date(body.nextActionDate) : null,
      promisedAmount: body.promisedAmountKes ?? null,
      promisedDate: body.promisedDate ? new Date(body.promisedDate) : null,
    },
    include: {
      performedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });

  await writeAuditLog(req.user.sub, 'LOG_COLLECTION_ACTION', 'collection_actions', action.id, req);
  res.status(201).json(action);
});

// ─── Branch-level collections summary ────────────────────────────────────────

export const collectionsSummary = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  const branchFilter = user?.branchId ? { customer: { branchId: user.branchId } } : {};

  const [day1, day7, day30, day90, total] = await Promise.all([
    prisma.loan.count({ where: { status: 'ACTIVE', daysInArrears: { gte: 1, lt: 7 }, ...branchFilter } }),
    prisma.loan.count({ where: { status: 'ACTIVE', daysInArrears: { gte: 7, lt: 30 }, ...branchFilter } }),
    prisma.loan.count({ where: { status: 'ACTIVE', daysInArrears: { gte: 30, lt: 90 }, ...branchFilter } }),
    prisma.loan.count({ where: { status: 'ACTIVE', daysInArrears: { gte: 90 }, ...branchFilter } }),
    prisma.loan.count({ where: { status: 'ACTIVE', ...branchFilter } }),
  ]);

  const overdueAgg = await prisma.loan.aggregate({
    where: { status: 'ACTIVE', daysInArrears: { gte: 1 }, ...branchFilter },
    _sum: { outstandingBalKes: true },
    _count: true,
  });

  res.json({
    buckets: { day1to6: day1, day7to29: day7, day30to89: day30, day90plus: day90 },
    totalActiveLoans: total,
    totalInArrears: overdueAgg._count,
    totalArrearsKes: overdueAgg._sum?.outstandingBalKes ?? 0,
    par30Rate: total > 0 ? ((day30 + day90) / total * 100).toFixed(2) : '0.00',
  });
});
