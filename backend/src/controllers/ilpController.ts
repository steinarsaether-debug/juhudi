import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import {
  computeOwnerScore,
  computeBusinessScore,
  computeOpsScore,
  computeCashFlowScore,
  computeCollateralScore,
  computeCompositeScore,
  deriveRecommendation,
  OwnerData,
  CashFlowData,
  CollateralItem,
} from '../services/ilpScoringService';
import { refreshCustomerTier } from '../services/awardService';
import { refreshKPIFlags, scheduleKPIFollowUps, getFlagGuidance } from '../services/kpiService';
import { configService } from '../services/configService';

async function writeAuditLog(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  req: Request,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId,
        ipAddress: req.ip ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? 'unknown',
      },
    });
  } catch (err) {
    logger.warn('[ILP] Audit log write failed', { err });
  }
}

interface BranchMetrics {
  par30: number;
  retention: number;
  growth: number;
}

async function computeBranchMetrics(branchId: string): Promise<BranchMetrics> {
  // PAR30: outstanding balance on loans ≥ 30 days in arrears / total outstanding
  const [par30Agg, totalAgg] = await Promise.all([
    prisma.loan.aggregate({
      where: { status: 'ACTIVE', daysInArrears: { gte: 30 }, customer: { branchId } },
      _sum: { outstandingBalKes: true },
    }),
    prisma.loan.aggregate({
      where: { status: 'ACTIVE', customer: { branchId } },
      _sum: { outstandingBalKes: true },
    }),
  ]);
  const totalOutstanding = totalAgg._sum.outstandingBalKes ?? 0;
  const par30Outstanding = par30Agg._sum.outstandingBalKes ?? 0;
  const par30 = totalOutstanding > 0 ? (par30Outstanding / totalOutstanding) * 100 : 0;

  // Retention: customers with ≥ 2 completed loans / customers with ≥ 1 completed loan
  const completedByCustomer = await prisma.loan.groupBy({
    by: ['customerId'],
    where: { status: 'COMPLETED', customer: { branchId } },
    _count: { id: true },
  });
  const withAtLeastOne = completedByCustomer.length;
  const withAtLeastTwo = completedByCustomer.filter(r => r._count.id >= 2).length;
  const retention = withAtLeastOne > 0 ? (withAtLeastTwo / withAtLeastOne) * 100 : 0;

  // Portfolio growth: current outstanding vs 6 months ago (using disbursedAt as proxy)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const [currentAgg, historicAgg] = await Promise.all([
    prisma.loan.aggregate({
      where: { status: 'ACTIVE', customer: { branchId } },
      _sum: { outstandingBalKes: true },
    }),
    prisma.loan.aggregate({
      where: {
        customer: { branchId },
        disbursedAt: { lte: sixMonthsAgo },
        status: { in: ['ACTIVE', 'COMPLETED'] },
      },
      _sum: { principalKes: true },
    }),
  ]);
  const currentKes  = currentAgg._sum.outstandingBalKes ?? 0;
  const historicKes = historicAgg._sum.principalKes ?? 0;
  const growth = historicKes > 0 ? ((currentKes - historicKes) / historicKes) * 100 : 0;

  return {
    par30:     parseFloat(par30.toFixed(2)),
    retention: parseFloat(retention.toFixed(2)),
    growth:    parseFloat(growth.toFixed(2)),
  };
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const segmentSchema = z.enum(['FARMER', 'LANDLORD', 'SHOP_OWNER']);

const assessmentSchema = z.object({
  segment: segmentSchema,
  ownerData: z.object({
    experienceYears:  z.number().min(0).max(60),
    crbStatus:        z.enum(['CLEAR', 'PERFORMING', 'UNKNOWN', 'LISTED']),
    loanHistoryType:  z.enum(['NONE', 'ON_TIME', 'SOME_LATE', 'DEFAULT']),
    referenceCount:   z.number().int().min(0).max(10),
  }),
  businessData: z.record(z.unknown()),
  operationalRiskData: z.record(z.unknown()),
  cashFlowData: z.object({
    totalMonthlyIncome:  z.number().min(0),
    existingMonthlyDebt: z.number().min(0),
    newInstallmentKes:   z.number().min(0),
    months: z.array(z.object({
      month:   z.string(),
      income:  z.number(),
      expense: z.number(),
    })).max(12).optional(),
  }),
  collateralData: z.object({
    items: z.array(z.object({
      type:       z.string(),
      valueKes:   z.number().min(0),
      isVerified: z.boolean().default(false),
    })),
    loanAmountKes: z.number().min(0),
  }),
  assessorNotes: z.string().max(2000).optional(),
});

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /ilp/branch-eligibility/:branchId
 * Returns live performance metrics and eligibility rows for the branch.
 */
export async function getBranchILPEligibility(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { branchId } = req.params;

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw new AppError(404, 'Branch not found');

  const metrics = await computeBranchMetrics(branchId);
  const maxPar30    = configService.num('ilp.eligibility.max_par30_pct');
  const minRetention = configService.num('ilp.eligibility.min_retention_pct');
  const minGrowth   = configService.num('ilp.eligibility.min_growth_pct');
  const meetsThreshold = metrics.par30 < maxPar30 && metrics.retention > minRetention && metrics.growth > minGrowth;

  const eligibilities = await prisma.branchILPEligibility.findMany({
    where: { branchId },
    orderBy: { segment: 'asc' },
  });

  const activeSegmentCount = eligibilities.filter(
    e => e.status === 'ELIGIBLE' || e.status === 'MASTERED',
  ).length;

  res.json({
    branchId,
    branchName: branch.name,
    metrics,
    thresholds: { maxPar30, minRetention, minGrowth },
    meetsThreshold,
    activeSegmentCount,
    eligibilities,
  });
}

/**
 * POST /ilp/branch-eligibility/:branchId/grant
 * Admin only. Grant a segment to a branch.
 */
export async function grantSegmentEligibility(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  if (req.user.role !== 'ADMIN') throw new AppError(403, 'Admin access required');

  const { branchId } = req.params;
  const body = z.object({
    segment: segmentSchema,
    notes:   z.string().max(500).optional(),
  }).parse(req.body);

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) throw new AppError(404, 'Branch not found');

  // Check max active segments
  const maxActiveSegments = configService.int('ilp.eligibility.max_active_segments');
  const activeCount = await prisma.branchILPEligibility.count({
    where: { branchId, status: { in: ['ELIGIBLE', 'MASTERED'] } },
  });
  if (activeCount >= maxActiveSegments) {
    throw new AppError(400, `Branch already has ${maxActiveSegments} active ILP segments. Revoke one before granting another.`);
  }

  // Progressive unlock: first segment must be MASTERED before a second can be added
  if (activeCount === 1) {
    const hasMastered = await prisma.branchILPEligibility.findFirst({
      where: { branchId, status: 'MASTERED' },
    });
    if (!hasMastered) {
      throw new AppError(
        400,
        'Branch must MASTER its first ILP segment before unlocking a second segment.',
      );
    }
  }

  const metrics = await computeBranchMetrics(branchId);

  const eligibility = await prisma.branchILPEligibility.upsert({
    where: { branchId_segment: { branchId, segment: body.segment } },
    create: {
      branchId,
      segment:           body.segment,
      status:            'ELIGIBLE',
      par30AtUnlock:     metrics.par30,
      retentionAtUnlock: metrics.retention,
      growthAtUnlock:    metrics.growth,
      unlockedAt:        new Date(),
      unlockedById:      req.user.sub,
      notes:             body.notes,
    },
    update: {
      status:            'ELIGIBLE',
      par30AtUnlock:     metrics.par30,
      retentionAtUnlock: metrics.retention,
      growthAtUnlock:    metrics.growth,
      unlockedAt:        new Date(),
      unlockedById:      req.user.sub,
      notes:             body.notes,
    },
  });

  await writeAuditLog(req.user.sub, 'GRANT_ILP_ELIGIBILITY', 'branch_ilp_eligibilities', eligibility.id, req);
  res.status(201).json(eligibility);
}

/**
 * PATCH /ilp/branch-eligibility/:branchId
 * Admin only. Promote to MASTERED or revoke (NOT_ELIGIBLE).
 */
export async function updateSegmentStatus(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  if (req.user.role !== 'ADMIN') throw new AppError(403, 'Admin access required');

  const { branchId } = req.params;
  const body = z.object({
    segment: segmentSchema,
    status:  z.enum(['MASTERED', 'NOT_ELIGIBLE']),
    notes:   z.string().max(500).optional(),
  }).parse(req.body);

  const existing = await prisma.branchILPEligibility.findUnique({
    where: { branchId_segment: { branchId, segment: body.segment } },
  });
  if (!existing) throw new AppError(404, 'Eligibility record not found');

  const updateData: Record<string, unknown> = { status: body.status };
  if (body.notes) updateData.notes = body.notes;
  if (body.status === 'MASTERED') {
    updateData.masteredAt   = new Date();
    updateData.masteredById = req.user.sub;
  }

  const updated = await prisma.branchILPEligibility.update({
    where: { branchId_segment: { branchId, segment: body.segment } },
    data:  updateData,
  });

  await writeAuditLog(
    req.user.sub,
    `ILP_STATUS_${body.status}`,
    'branch_ilp_eligibilities',
    updated.id,
    req,
  );
  res.json(updated);
}

/**
 * POST /ilp/assessment/:applicationId
 * Save (or update) the ILP assessment for a loan application.
 * Scores all five dimensions, checks the DSR hard-block, and derives recommendation.
 */
export async function saveILPAssessment(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { applicationId } = req.params;
  const body = assessmentSchema.parse(req.body);

  // Verify application exists and is an individual loan
  const app = await prisma.loanApplication.findUnique({
    where:  { id: applicationId },
    select: { id: true, loanType: true, status: true },
  });
  if (!app) throw new AppError(404, 'Loan application not found');
  if (app.loanType !== 'INDIVIDUAL') {
    throw new AppError(400, 'ILP assessment only applies to individual loan applications');
  }

  // Score each dimension
  const ownerScore = computeOwnerScore(body.ownerData as OwnerData);
  const businessScore = computeBusinessScore(body.segment, body.businessData);
  const operationalRiskScore = computeOpsScore(body.segment, body.operationalRiskData);

  const { score: cashFlowScore, dsr, hardBlock } = computeCashFlowScore(body.cashFlowData as CashFlowData);
  if (hardBlock) {
    throw new AppError(
      400,
      `DSR of ${dsr.toFixed(1)}% exceeds 50%. This ILP application cannot proceed. ` +
      `Please reduce the loan amount or verify income figures.`,
    );
  }

  const collateralScore = computeCollateralScore(
    body.collateralData.items as CollateralItem[],
    body.collateralData.loanAmountKes,
  );

  const compositeScore = computeCompositeScore({
    ownerScore, businessScore, operationalRiskScore, cashFlowScore, collateralScore,
  });
  const ilpRecommendation = deriveRecommendation(compositeScore);

  // Upsert assessment — cast to unknown first to satisfy Prisma's InputJsonValue constraint
  const j = <T>(v: T) => v as unknown as ReturnType<typeof JSON.parse>;

  const assessment = await prisma.iLPAssessment.upsert({
    where:  { loanApplicationId: applicationId },
    create: {
      loanApplicationId: applicationId,
      segment:             body.segment,
      ownerScore,          ownerData:           j(body.ownerData),
      businessScore,       businessData:        j(body.businessData),
      operationalRiskScore, operationalRiskData: j(body.operationalRiskData),
      cashFlowScore,       cashFlowData:        j(body.cashFlowData),
      collateralScore,     collateralData:      j(body.collateralData),
      compositeScore,      ilpRecommendation,
      assessorNotes:       body.assessorNotes,
    },
    update: {
      ownerScore,          ownerData:           j(body.ownerData),
      businessScore,       businessData:        j(body.businessData),
      operationalRiskScore, operationalRiskData: j(body.operationalRiskData),
      cashFlowScore,       cashFlowData:        j(body.cashFlowData),
      collateralScore,     collateralData:      j(body.collateralData),
      compositeScore,      ilpRecommendation,
      assessorNotes:       body.assessorNotes,
    },
  });

  // Ensure LoanApplication has the ilpSegment set
  await prisma.loanApplication.update({
    where: { id: applicationId },
    data:  { ilpSegment: body.segment },
  });

  await writeAuditLog(req.user.sub, 'SAVE_ILP_ASSESSMENT', 'ilp_assessments', assessment.id, req);

  res.json({
    assessment,
    scores: {
      ownerScore, businessScore, operationalRiskScore,
      cashFlowScore, collateralScore, compositeScore,
      ilpRecommendation, dsr,
    },
  });
}

/**
 * GET /ilp/assessment/:applicationId
 * Fetch the ILP assessment for a loan application.
 */
export async function getILPAssessment(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { applicationId } = req.params;

  const assessment = await prisma.iLPAssessment.findUnique({
    where: { loanApplicationId: applicationId },
  });
  if (!assessment) throw new AppError(404, 'ILP assessment not found for this application');

  res.json(assessment);
}

/**
 * GET /ilp/follow-up/:loanId
 * List all ILP follow-up tasks for a loan, ordered by scheduledDate.
 */
export async function getILPFollowUpSchedule(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { loanId } = req.params;

  const followUps = await prisma.iLPFollowUp.findMany({
    where:   { loanId },
    orderBy: { scheduledDate: 'asc' },
    include: {
      completedBy: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  res.json(followUps);
}

/**
 * PATCH /ilp/follow-up/:followUpId/complete
 * Mark a follow-up visit as completed.
 */
export async function completeFollowUp(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { followUpId } = req.params;

  const body = z.object({
    visitNotes: z.string().max(2000).optional(),
    riskFlags:  z.array(z.string().max(200)).max(10).default([]),
  }).parse(req.body);

  const followUp = await prisma.iLPFollowUp.findUnique({ where: { id: followUpId } });
  if (!followUp) throw new AppError(404, 'Follow-up not found');
  if (followUp.isCompleted) throw new AppError(400, 'This follow-up has already been completed');

  const updated = await prisma.iLPFollowUp.update({
    where: { id: followUpId },
    data:  {
      isCompleted:   true,
      completedAt:   new Date(),
      completedById: req.user.sub,
      visitNotes:    body.visitNotes,
      riskFlags:     body.riskFlags,
    },
  });

  await writeAuditLog(req.user.sub, 'COMPLETE_ILP_FOLLOWUP', 'ilp_follow_ups', followUpId, req);

  // Refresh KPI flags and re-schedule follow-ups after visit completion
  refreshKPIFlags(followUp.loanId)
    .then(async (result) => {
      if (result.created > 0 || result.resolved >= 0) {
        // Re-schedule KPI follow-ups based on updated flag state
        const loan = await prisma.loan.findUnique({
          where:  { id: followUp.loanId },
          select: { ilpCycleNumber: true, application: { select: { ilpSegment: true } } },
        });
        if (loan?.ilpCycleNumber && loan.application?.ilpSegment) {
          await scheduleKPIFollowUps(followUp.loanId, loan.application.ilpSegment, loan.ilpCycleNumber);
        }
      }
    })
    .catch(err => console.error('[KPI] Flag refresh failed after follow-up:', err));

  // Refresh customer award tier
  const loanForTier = await prisma.loan.findUnique({
    where:  { id: followUp.loanId },
    select: { customerId: true },
  });
  if (loanForTier) {
    refreshCustomerTier(loanForTier.customerId).catch(err =>
      console.error('[Award] Tier refresh failed:', err),
    );
  }

  res.json(updated);
}

/**
 * GET /ilp/risk-flags/:loanId
 * List all CustomerRiskFlags for an ILP loan.
 */
export async function getRiskFlags(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { loanId } = req.params;

  const flags = await prisma.customerRiskFlag.findMany({
    where:   { loanId },
    orderBy: [{ isActive: 'desc' }, { severity: 'asc' }, { createdAt: 'desc' }],
    include: {
      resolvedBy: { select: { firstName: true, lastName: true } },
    },
  });

  // Attach guidance to each flag
  const withGuidance = flags.map(f => ({
    ...f,
    guidance: getFlagGuidance(f.indicator),
  }));

  res.json(withGuidance);
}

/**
 * PATCH /ilp/risk-flags/:flagId/resolve
 * Manually resolve a flag (BM / Supervisor / Admin only).
 */
export async function resolveRiskFlag(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  if (!['BRANCH_MANAGER', 'SUPERVISOR', 'ADMIN'].includes(req.user.role)) {
    throw new AppError(403, 'Only Branch Managers, Supervisors, or Admins can resolve risk flags');
  }

  const { flagId } = req.params;
  const body = z.object({
    note: z.string().min(10).max(1000),
  }).parse(req.body);

  const flag = await prisma.customerRiskFlag.findUnique({ where: { id: flagId } });
  if (!flag) throw new AppError(404, 'Risk flag not found');
  if (!flag.isActive) throw new AppError(400, 'Risk flag is already resolved');

  const updated = await prisma.customerRiskFlag.update({
    where: { id: flagId },
    data: {
      isActive:     false,
      resolvedAt:   new Date(),
      resolvedNote: body.note,
      resolvedById: req.user.sub,
    },
  });

  await writeAuditLog(req.user.sub, 'RESOLVE_RISK_FLAG', 'customer_risk_flags', flagId, req);
  res.json(updated);
}

/**
 * GET /lo/worklist
 * Unified LO worklist — all pending ILP follow-ups scoped to the requesting user's customers.
 * Includes both scheduled milestone visits and KPI_CHECK tasks.
 */
export async function getLOWorklist(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const userId   = req.user.sub;
  const userRole = req.user.role;

  // Determine whose follow-ups to show
  // LO: only their applications; BM/Supervisor: entire branch
  let loanFilter: Record<string, unknown> = {};
  if (userRole === 'LOAN_OFFICER') {
    loanFilter = { application: { officerId: userId } };
  } else if (req.user.branchId) {
    loanFilter = { customer: { branchId: req.user.branchId } };
  }

  const followUps = await prisma.iLPFollowUp.findMany({
    where: {
      isCompleted: false,
      loan: loanFilter,
    },
    orderBy: { scheduledDate: 'asc' },
    include: {
      loan: {
        select: {
          loanNumber:    true,
          ilpCycleNumber: true,
          customer: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      },
      riskFlag: {
        select: { severity: true, indicator: true, title: true, isActive: true },
      },
    },
  });

  // Group: OVERDUE (past due), TODAY, THIS_WEEK, UPCOMING
  const now        = new Date();
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const weekEnd    = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);

  const grouped = {
    OVERDUE:    [] as typeof followUps,
    TODAY:      [] as typeof followUps,
    THIS_WEEK:  [] as typeof followUps,
    UPCOMING:   [] as typeof followUps,
  };

  for (const fu of followUps) {
    const due = new Date(fu.scheduledDate);
    if (due < now)         grouped.OVERDUE.push(fu);
    else if (due <= todayEnd) grouped.TODAY.push(fu);
    else if (due <= weekEnd)  grouped.THIS_WEEK.push(fu);
    else                      grouped.UPCOMING.push(fu);
  }

  res.json({
    total: followUps.length,
    grouped,
  });
}

// ─── Follow-Up Schedule Generator ────────────────────────────────────────────
// Called internally from loanController.ts after disbursement.

interface FollowUpTemplate {
  offsetDays?:   number;
  offsetMonths?: number;
  visitType:     string;
  milestone:     string;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

const CYCLE1_LONG: FollowUpTemplate[] = [
  { offsetDays: 7,   visitType: 'FIELD_VISIT',   milestone: 'Week 1 — Fund deployment verification' },
  { offsetMonths: 1, visitType: 'FIELD_VISIT',   milestone: 'Month 1 — Business check-in' },
  { offsetMonths: 2, visitType: 'PHONE_CALL',    milestone: 'Month 2 — Payment follow-up' },
  { offsetMonths: 3, visitType: 'FIELD_VISIT',   milestone: 'Month 3 — Mid-term business review' },
  { offsetMonths: 6, visitType: 'FIELD_VISIT',   milestone: 'Month 6 — Closing assessment & cycle 2 eligibility' },
];

const CYCLE1_SHORT: FollowUpTemplate[] = [
  { offsetDays: 7,   visitType: 'FIELD_VISIT',   milestone: 'Week 1 — Fund deployment verification' },
  { offsetMonths: 1, visitType: 'FIELD_VISIT',   milestone: 'Month 1 — Business check-in' },
  { offsetMonths: 2, visitType: 'PHONE_CALL',    milestone: 'Month 2 — Payment follow-up' },
  { offsetMonths: 3, visitType: 'FIELD_VISIT',   milestone: 'Month 3 — Mid-term business review' },
  { offsetMonths: 5, visitType: 'FIELD_VISIT',   milestone: 'Month 5 — Pre-close assessment' },
];

const CYCLE2: FollowUpTemplate[] = [
  { offsetDays: 7,   visitType: 'PHONE_CALL',    milestone: 'Week 1 — Fund deployment check' },
  { offsetMonths: 1, visitType: 'PHONE_CALL',    milestone: 'Month 1 — Follow-up call' },
  { offsetMonths: 3, visitType: 'FIELD_VISIT',   milestone: 'Month 3 — Quarterly business review' },
  { offsetMonths: 6, visitType: 'PHONE_CALL',    milestone: 'Month 6 — Semester check-in' },
];

export async function generateFollowUpSchedule(
  loanId:      string,
  segment:     'FARMER' | 'LANDLORD' | 'SHOP_OWNER',
  cycleNumber: number,
  disbursedAt: Date,
  termMonths:  number,
): Promise<void> {
  const isShortTerm = termMonths <= 6;
  let templates: FollowUpTemplate[];

  if (cycleNumber >= 2)     templates = CYCLE2;
  else if (isShortTerm)     templates = CYCLE1_SHORT;
  else                      templates = CYCLE1_LONG;

  const followUps = templates.map(t => ({
    loanId,
    segment,
    loanCycle:     cycleNumber,
    scheduledDate: t.offsetDays
      ? addDays(disbursedAt, t.offsetDays)
      : addMonths(disbursedAt, t.offsetMonths!),
    visitType:     t.visitType,
    milestone:     t.milestone,
  }));

  await prisma.iLPFollowUp.createMany({ data: followUps });
  logger.info(`[ILP] Generated ${followUps.length} follow-up entries for loan ${loanId} (cycle ${cycleNumber})`);
}
