import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';
import { asyncHandler } from '../utils/asyncHandler';
import { broadcastToSession, subscribeSession } from '../utils/sseStore';
import { notifyUsers } from '../utils/notifyUsers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BM_ROLES = ['BRANCH_MANAGER', 'ADMIN'] as const;
const COMMITTEE_ROLES = ['BRANCH_MANAGER', 'SUPERVISOR', 'LOAN_OFFICER'] as const;

function canManageBcc(role: string) { return BM_ROLES.includes(role as typeof BM_ROLES[number]); }
function canVote(role: string) { return COMMITTEE_ROLES.includes(role as typeof COMMITTEE_ROLES[number]); }

/** Compute consensus outcome from current votes */
function deriveConsensus(votes: Array<{ vote: string }>, quorum: number) {
  const endorse = votes.filter(v => v.vote === 'ENDORSE').length;
  const refuse  = votes.filter(v => v.vote === 'REFUSE').length;
  const total   = votes.filter(v => v.vote !== 'ABSTAIN').length;
  if (total < quorum) return null;
  if (endorse > refuse) return 'APPROVED';
  if (refuse > endorse) return 'REFUSED';
  return null; // tied – no consensus yet
}

// ─── Open a BCC session ───────────────────────────────────────────────────────

const openSchema = z.object({
  loanApplicationId: z.string().uuid(),
  quorumRequired: z.number().int().min(2).max(10).default(2),
  outcomeNotes: z.string().max(1000).optional(),
});

export const openSession = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  if (!canManageBcc(req.user.role)) throw new AppError(403, 'Only Branch Manager or Admin can open BCC sessions');

  const body = openSchema.parse(req.body);

  const application = await prisma.loanApplication.findUnique({
    where: { id: body.loanApplicationId },
    include: { customer: { select: { firstName: true, lastName: true } }, bccSession: true },
  });
  if (!application) throw new AppError(404, 'Loan application not found');
  if (application.bccSession) throw new AppError(409, 'A BCC session already exists for this application');
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(application.status)) {
    throw new AppError(400, 'Application must be SUBMITTED or UNDER_REVIEW to open BCC');
  }

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user?.branchId) throw new AppError(400, 'Your account is not assigned to a branch');

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

  const session = await prisma.$transaction(async (tx) => {
    const s = await tx.bccSession.create({
      data: {
        loanApplicationId: body.loanApplicationId,
        branchId: user.branchId!,
        quorumRequired: body.quorumRequired,
        outcomeNotes: body.outcomeNotes,
        expiresAt,
        createdByUserId: req.user!.sub,
      },
      include: {
        loanApplication: {
          include: { customer: { select: { firstName: true, lastName: true } }, creditScore: true },
        },
        votes: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        comments: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
      },
    });
    // Move application to UNDER_REVIEW
    await tx.loanApplication.update({
      where: { id: body.loanApplicationId },
      data: { status: 'UNDER_REVIEW' },
    });
    return s;
  });

  await writeAuditLog(req.user.sub, 'OPEN_BCC_SESSION', 'bcc_sessions', session.id, req);
  res.status(201).json(session);
});

// ─── List sessions (branch-scoped) ───────────────────────────────────────────

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user?.branchId) throw new AppError(400, 'Your account is not assigned to a branch');

  const status = req.query.status as string | undefined;
  const page  = Math.max(1, parseInt(req.query.page as string ?? '1'));
  const limit = Math.min(50, parseInt(req.query.limit as string ?? '20'));

  const where = {
    branchId: user.branchId,
    ...(status ? { status: status as 'OPEN' | 'DECIDED' | 'OVERRIDDEN' | 'EXPIRED' } : {}),
  };

  const [sessions, total] = await Promise.all([
    prisma.bccSession.findMany({
      where,
      orderBy: [{ status: 'asc' }, { openedAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        loanApplication: {
          include: {
            customer: { select: { id: true, firstName: true, lastName: true, county: true } },
            officer: { select: { id: true, firstName: true, lastName: true } },
            creditScore: { select: { totalScore: true, recommendation: true } },
          },
        },
        votes: { select: { vote: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.bccSession.count({ where }),
  ]);

  res.json({ data: sessions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

// ─── Get session detail ───────────────────────────────────────────────────────

export const getSession = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });

  const session = await prisma.bccSession.findUnique({
    where: { id: req.params.id },
    include: {
      loanApplication: {
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, county: true, subCounty: true, village: true, numberOfDependents: true },
            include: { farmProfile: true, financialProfile: true },
          },
          officer: { select: { id: true, firstName: true, lastName: true } },
          creditScore: true,
        },
      },
      branch: { select: { id: true, name: true, code: true } },
      votes: {
        orderBy: { votedAt: 'asc' },
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      },
    },
  });

  if (!session) throw new AppError(404, 'BCC session not found');
  // Branch-scope check (admins can see all)
  if (req.user.role !== 'ADMIN' && user?.branchId !== session.branchId) {
    throw new AppError(403, 'Access denied – different branch');
  }

  await writeAuditLog(req.user.sub, 'VIEW_BCC_SESSION', 'bcc_sessions', session.id, req);
  res.json(session);
});

// ─── Cast / update vote ───────────────────────────────────────────────────────

const voteSchema = z.object({
  vote: z.enum(['ENDORSE', 'REFUSE', 'ABSTAIN']),
  rationale: z.string().max(1000).optional(),
});

export const castVote = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  if (!canVote(req.user.role)) throw new AppError(403, 'Your role cannot vote in BCC sessions');

  const body = voteSchema.parse(req.body);

  const session = await prisma.bccSession.findUnique({
    where: { id: req.params.id },
    include: { votes: true },
  });
  if (!session) throw new AppError(404, 'BCC session not found');
  if (session.status !== 'OPEN') throw new AppError(409, `Session is already ${session.status} – voting closed`);

  const updatedVote = await prisma.bccVote.upsert({
    where: { sessionId_userId: { sessionId: session.id, userId: req.user.sub } },
    create: { sessionId: session.id, userId: req.user.sub, vote: body.vote, rationale: body.rationale },
    update: { vote: body.vote, rationale: body.rationale, updatedAt: new Date() },
    include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
  });

  // Check if consensus now reached
  const allVotes = await prisma.bccVote.findMany({ where: { sessionId: session.id } });
  const consensus = deriveConsensus(allVotes, session.quorumRequired);
  if (consensus) {
    await prisma.bccSession.update({
      where: { id: session.id },
      data: {
        status: 'DECIDED',
        outcome: consensus as 'APPROVED' | 'REFUSED',
        closedAt: new Date(),
      },
    });
    // Auto-update the loan application status
    const appStatus = consensus === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    await prisma.loanApplication.update({
      where: { id: session.loanApplicationId },
      data: { status: appStatus, reviewedByUserId: req.user.sub, reviewedAt: new Date() },
    });
  }

  broadcastToSession(session.id, 'vote', { vote: updatedVote, consensusReached: !!consensus, outcome: consensus });

  await writeAuditLog(req.user.sub, 'CAST_BCC_VOTE', 'bcc_votes', updatedVote.id, req);
  res.json({ vote: updatedVote, consensusReached: !!consensus, outcome: consensus });
});

// ─── Add comment ─────────────────────────────────────────────────────────────

const commentSchema = z.object({ body: z.string().min(1).max(2000) });

export const addComment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const body = commentSchema.parse(req.body);
  const session = await prisma.bccSession.findUnique({ where: { id: req.params.id } });
  if (!session) throw new AppError(404, 'BCC session not found');
  if (session.status !== 'OPEN') throw new AppError(409, 'Session is closed – no new comments');

  const comment = await prisma.bccComment.create({
    data: { sessionId: session.id, userId: req.user.sub, body: body.body },
    include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
  });

  broadcastToSession(session.id, 'comment', comment);
  res.status(201).json(comment);
});

// ─── Branch Manager decide (force / override) ─────────────────────────────────

const decideSchema = z.object({
  outcome: z.enum(['APPROVED', 'REFUSED', 'REFERRED', 'CONDITIONAL']),
  override: z.boolean().default(false),
  overrideReason: z.string().max(1000).optional(),
  outcomeNotes: z.string().max(1000).optional(),
  approvedAmountKes: z.number().min(0).optional(),
  interestRatePct: z.number().min(0).optional(),
});

export const decide = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  if (!canManageBcc(req.user.role)) throw new AppError(403, 'Only Branch Manager or Admin can close BCC sessions');

  const body = decideSchema.parse(req.body);

  const session = await prisma.bccSession.findUnique({
    where: { id: req.params.id },
    include: { votes: true },
  });
  if (!session) throw new AppError(404, 'BCC session not found');
  if (session.status !== 'OPEN') throw new AppError(409, `Session is already ${session.status}`);

  if (body.override && !body.overrideReason) {
    throw new AppError(400, 'Override reason is required when overriding committee decision');
  }

  // Check if this is genuinely an override (votes exist and majority disagrees)
  const endorseCount = session.votes.filter(v => v.vote === 'ENDORSE').length;
  const refuseCount  = session.votes.filter(v => v.vote === 'REFUSE').length;
  const majorityOutcome = endorseCount > refuseCount ? 'APPROVED'
    : refuseCount > endorseCount ? 'REFUSED' : null;
  const isActualOverride = body.override &&
    majorityOutcome !== null &&
    majorityOutcome !== body.outcome;

  await prisma.$transaction(async (tx) => {
    await tx.bccSession.update({
      where: { id: session.id },
      data: {
        status: isActualOverride ? 'OVERRIDDEN' : 'DECIDED',
        outcome: body.outcome,
        outcomeNotes: body.outcomeNotes,
        managerOverride: isActualOverride,
        overrideReason: isActualOverride ? body.overrideReason : null,
        overriddenById: isActualOverride ? req.user!.sub : null,
        closedAt: new Date(),
      },
    });

    // Update loan application
    const appStatus = body.outcome === 'APPROVED' || body.outcome === 'CONDITIONAL'
      ? (body.outcome === 'CONDITIONAL' ? 'CONDITIONALLY_APPROVED' : 'APPROVED')
      : body.outcome === 'REFUSED'
      ? 'REJECTED'
      : 'UNDER_REVIEW'; // REFERRED stays under review

    await tx.loanApplication.update({
      where: { id: session.loanApplicationId },
      data: {
        status: appStatus,
        reviewedByUserId: req.user!.sub,
        reviewedAt: new Date(),
        reviewNotes: body.outcomeNotes,
        ...(body.approvedAmountKes ? { approvedAmountKes: body.approvedAmountKes } : {}),
        ...(body.interestRatePct   ? { interestRatePct: body.interestRatePct }     : {}),
      },
    });
  });

  broadcastToSession(session.id, 'session_closed', { outcome: body.outcome, override: isActualOverride });

  // Notify branch users
  const branchSession = await prisma.bccSession.findUnique({
    where: { id: session.id },
    select: {
      branchId: true,
      loanApplication: { select: { customer: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (branchSession) {
    const branchUsers = await prisma.user.findMany({
      where: { branchId: branchSession.branchId, isActive: true, id: { not: req.user!.sub } },
      select: { id: true },
    });
    const customerName = `${branchSession.loanApplication.customer.firstName} ${branchSession.loanApplication.customer.lastName}`;
    await notifyUsers(
      branchUsers.map(u => u.id),
      'BCC_DECISION_MADE',
      `BCC decision: ${body.outcome} — ${customerName}`,
      null,
      'BccSession',
      session.id,
    );
  }

  await writeAuditLog(req.user.sub, isActualOverride ? 'OVERRIDE_BCC' : 'DECIDE_BCC', 'bcc_sessions', session.id, req);
  res.json({ success: true, outcome: body.outcome, override: isActualOverride });
});

// ─── SSE Stream ───────────────────────────────────────────────────────────────

export const streamSession = asyncHandler(async (req: Request, res: Response) => {
  // EventSource cannot set headers — JWT passed as ?token= query param
  const token = req.query.token as string | undefined;
  if (!token) throw new AppError(401, 'Missing token query parameter');

  let payload: { sub: string; role: string; branchId: string | null };
  try {
    payload = jwt.verify(token, config.JWT_SECRET) as typeof payload;
  } catch {
    throw new AppError(401, 'Invalid or expired token');
  }

  const session = await prisma.bccSession.findUnique({ where: { id: req.params.sessionId } });
  if (!session) throw new AppError(404, 'BCC session not found');

  // Branch-scope check
  if (payload.role !== 'ADMIN' && payload.branchId !== session.branchId) {
    throw new AppError(403, 'Access denied – different branch');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Send initial state
  res.write(`event: connected\ndata: ${JSON.stringify({ sessionId: session.id })}\n\n`);

  subscribeSession(session.id, res);
  // Note: cleanup on 'close' event is handled inside subscribeSession
});

// ─── LO Case Presentation ─────────────────────────────────────────────────────

export const getCasePresentation = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const session = await prisma.bccSession.findUnique({
    where: { id: req.params.id },
    include: {
      loanApplication: {
        include: {
          customer: {
            include: {
              farmProfile: true,
              financialProfile: true,
              kycDocuments: { orderBy: { uploadedAt: 'desc' }, take: 3 },
            },
          },
          officer: { select: { id: true, firstName: true, lastName: true } },
          creditScore: true,
          ilpAssessment: true,
          collateral: true,
          loanProduct: true,
        },
      },
      flags: {
        orderBy: { createdAt: 'desc' },
        include: { raisedBy: { select: { id: true, firstName: true, lastName: true, role: true } } },
      },
      conditions: {
        orderBy: { createdAt: 'asc' },
        include: { addedBy: { select: { id: true, firstName: true, lastName: true } } },
      },
      votes: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
      },
    },
  });

  if (!session) throw new AppError(404, 'BCC session not found');

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (req.user.role !== 'ADMIN' && user?.branchId !== session.branchId) {
    throw new AppError(403, 'Access denied – different branch');
  }

  // Fetch supplementary data in parallel
  const [latestInterview, latestMpesa, previousLoans, qualityFlags] = await Promise.all([
    prisma.customerInterview.findFirst({
      where: { customerId: session.loanApplication.customerId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
    }),
    prisma.mpesaStatement.findFirst({
      where: { customerId: session.loanApplication.customerId, analysisStatus: 'COMPLETE' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        overallRiskLevel: true,
        riskSummary: true,
        recommendedAction: true,
        detectedLoans: true,
        suspiciousPatterns: true,
        gamblingTransactions: true,
        positiveIndicators: true,
        avgMonthlyInflow: true,
        avgMonthlyOutflow: true,
        avgMonthlyNet: true,
        fulizaUsageCount: true,
      },
    }),
    prisma.loan.findMany({
      where: { customerId: session.loanApplication.customerId },
      orderBy: { disbursedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        principalKes: true,
        disbursedAt: true,
        maturityDate: true,
        daysInArrears: true,
      },
    }),
    // DataQualityFlag uses entityType/entityId strings (no direct relation)
    prisma.dataQualityFlag.findMany({
      where: { entityType: 'LOAN_APPLICATION', entityId: session.loanApplicationId, isResolved: false },
    }),
  ]);

  const app = session.loanApplication;
  const customer = app.customer;

  res.json({
    sessionId: session.id,
    sessionStatus: session.status,
    outcome: session.outcome,
    presentedAt: session.presentedAt,
    loRecommendation: session.loRecommendation,
    loNarrative: session.loNarrative,

    // 10 structured sections
    borrowerProfile: {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      gender: customer.gender,
      dateOfBirth: customer.dateOfBirth,
      maritalStatus: customer.maritalStatus,
      numberOfDependents: customer.numberOfDependents,
      county: customer.county,
      subCounty: customer.subCounty,
      village: customer.village,
      currentTier: customer.currentTier,
      yaraCustomerId: customer.yaraCustomerId,
    },
    farmAndBusiness: {
      farmProfile: customer.farmProfile,
      financialProfile: customer.financialProfile,
    },
    loanRequest: {
      id: app.id,
      loanType: app.loanType,
      requestedAmountKes: app.requestedAmountKes,
      approvedAmountKes: app.approvedAmountKes,
      termMonths: app.termMonths,
      interestRatePct: app.interestRatePct,
      purposeCategory: app.purposeCategory,
      purposeOfLoan: app.purposeOfLoan,
      repaymentMethod: app.repaymentMethod,
      loanProduct: app.loanProduct,
      ilpSegment: app.ilpSegment,
      officer: app.officer,
    },
    repaymentCapacity: {
      creditScore: app.creditScore,
      ilpAssessment: app.ilpAssessment,
    },
    creditBackground: {
      previousLoans,
      latestInterview: latestInterview
        ? {
            id: latestInterview.id,
            status: latestInterview.status,
            scorePercent: latestInterview.scorePercent,
            recommendation: latestInterview.recommendation,
            completedAt: latestInterview.completedAt,
            loNotes: latestInterview.loNotes,
          }
        : null,
    },
    collateral: app.collateral,
    riskRating: {
      creditScore: app.creditScore,
      qualityFlags,
    },
    mpesaAnalysis: latestMpesa,
    officerRecommendation: {
      officer: app.officer,
      loRecommendation: session.loRecommendation,
      loNarrative: session.loNarrative,
    },
    committeeDiscussion: {
      votes: session.votes,
      comments: session.comments,
      flags: session.flags,
      conditions: session.conditions,
    },
  });
});

// ─── Update LO narrative / recommendation ────────────────────────────────────

const loNarrativeSchema = z.object({
  loRecommendation: z.enum(['RECOMMEND_APPROVE', 'RECOMMEND_CONDITIONAL', 'RECOMMEND_DECLINE']).optional(),
  loNarrative: z.string().max(5000).optional(),
});

export const updateLoNarrative = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const body = loNarrativeSchema.parse(req.body);
  const session = await prisma.bccSession.findUnique({ where: { id: req.params.id } });
  if (!session) throw new AppError(404, 'BCC session not found');

  const updated = await prisma.bccSession.update({
    where: { id: session.id },
    data: {
      ...(body.loRecommendation !== undefined ? { loRecommendation: body.loRecommendation } : {}),
      ...(body.loNarrative !== undefined      ? { loNarrative: body.loNarrative }            : {}),
    },
  });

  broadcastToSession(session.id, 'narrative_updated', {
    loRecommendation: updated.loRecommendation,
    loNarrative: updated.loNarrative,
  });
  res.json(updated);
});

// ─── Flags ────────────────────────────────────────────────────────────────────

const flagSchema = z.object({
  category: z.enum([
    'REPAYMENT_CAPACITY', 'PURPOSE_RISK', 'CHARACTER_CONCERN',
    'SECTOR_RISK', 'COLLATERAL_WEAKNESS', 'DATA_QUALITY', 'OTHER',
  ]),
  severity: z.enum(['YELLOW', 'RED']),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const raiseFlag = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const body = flagSchema.parse(req.body);
  const session = await prisma.bccSession.findUnique({
    where: { id: req.params.id },
    select: { id: true, branchId: true, status: true },
  });
  if (!session) throw new AppError(404, 'BCC session not found');
  if (session.status !== 'OPEN') throw new AppError(409, 'Session is closed');

  const flag = await prisma.bccFlag.create({
    data: {
      sessionId: session.id,
      raisedById: req.user.sub,
      ...body,
    },
    include: { raisedBy: { select: { id: true, firstName: true, lastName: true, role: true } } },
  });

  broadcastToSession(session.id, 'flag', flag);

  // Notify branch managers
  const bms = await prisma.user.findMany({
    where: { branchId: session.branchId, isActive: true, role: { in: ['BRANCH_MANAGER', 'ADMIN'] }, id: { not: req.user.sub } },
    select: { id: true },
  });
  await notifyUsers(bms.map(u => u.id), 'BCC_FLAG_RAISED', `Flag raised: ${body.title}`, body.description ?? null, 'BccSession', session.id);

  res.status(201).json(flag);
});

const resolveFlagSchema = z.object({ resolvedNote: z.string().max(1000).optional() });

export const resolveFlag = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const flag = await prisma.bccFlag.findUnique({ where: { id: req.params.flagId } });
  if (!flag) throw new AppError(404, 'Flag not found');

  const body = resolveFlagSchema.parse(req.body);

  const updated = await prisma.bccFlag.update({
    where: { id: flag.id },
    data: { isResolved: true, resolvedById: req.user.sub, resolvedAt: new Date(), resolvedNote: body.resolvedNote },
  });

  broadcastToSession(flag.sessionId, 'flag_resolved', { flagId: flag.id });
  res.json(updated);
});

const flagOutcomeSchema = z.object({
  didMaterialize: z.boolean(),
  materializedNote: z.string().max(2000).optional(),
});

export const recordFlagOutcome = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const body = flagOutcomeSchema.parse(req.body);
  const updated = await prisma.bccFlag.update({
    where: { id: req.params.flagId },
    data: { didMaterialize: body.didMaterialize, materializedNote: body.materializedNote },
  });

  res.json(updated);
});

// ─── Conditions ───────────────────────────────────────────────────────────────

const conditionSchema = z.object({
  description: z.string().min(1).max(2000),
  dueDate: z.string().datetime().optional(),
});

export const addCondition = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const body = conditionSchema.parse(req.body);
  const session = await prisma.bccSession.findUnique({ where: { id: req.params.id } });
  if (!session) throw new AppError(404, 'BCC session not found');

  const condition = await prisma.bccCondition.create({
    data: {
      sessionId: session.id,
      addedById: req.user.sub,
      description: body.description,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    },
    include: { addedBy: { select: { id: true, firstName: true, lastName: true } } },
  });

  broadcastToSession(session.id, 'condition', condition);
  res.status(201).json(condition);
});

const verifyConditionSchema = z.object({ verifiedNote: z.string().max(1000).optional() });

export const verifyCondition = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const body = verifyConditionSchema.parse(req.body);
  const updated = await prisma.bccCondition.update({
    where: { id: req.params.condId },
    data: { verifiedAt: new Date(), verifiedById: req.user.sub, verifiedNote: body.verifiedNote },
  });

  res.json(updated);
});

// ─── Flag Accuracy Analytics ──────────────────────────────────────────────────

export const getFlagAccuracy = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const periodMonths = Math.min(24, parseInt(req.query.months as string ?? '12'));
  const since = new Date();
  since.setMonth(since.getMonth() - periodMonths);

  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  const branchId = req.user.role === 'ADMIN'
    ? (req.query.branchId as string | undefined)
    : user?.branchId ?? undefined;

  // Flags with resolved outcomes in the period
  const flags = await prisma.bccFlag.findMany({
    where: {
      createdAt: { gte: since },
      didMaterialize: { not: null },
      session: branchId ? { branchId } : undefined,
    },
    select: {
      category: true,
      severity: true,
      didMaterialize: true,
      raisedById: true,
      raisedBy: { select: { firstName: true, lastName: true } },
    },
  });

  // Group by category
  const byCategory: Record<string, { total: number; materialized: number; rate: number }> = {};
  for (const flag of flags) {
    if (!byCategory[flag.category]) byCategory[flag.category] = { total: 0, materialized: 0, rate: 0 };
    byCategory[flag.category].total++;
    if (flag.didMaterialize) byCategory[flag.category].materialized++;
  }
  for (const cat of Object.values(byCategory)) {
    cat.rate = cat.total > 0 ? Math.round((cat.materialized / cat.total) * 100) : 0;
  }

  // Group by officer
  const byOfficer: Record<string, { name: string; total: number; materialized: number; rate: number }> = {};
  for (const flag of flags) {
    const key = flag.raisedById;
    if (!byOfficer[key]) {
      byOfficer[key] = {
        name: `${flag.raisedBy.firstName} ${flag.raisedBy.lastName}`,
        total: 0,
        materialized: 0,
        rate: 0,
      };
    }
    byOfficer[key].total++;
    if (flag.didMaterialize) byOfficer[key].materialized++;
  }
  for (const off of Object.values(byOfficer)) {
    off.rate = off.total > 0 ? Math.round((off.materialized / off.total) * 100) : 0;
  }

  res.json({
    periodMonths,
    totalFlags: flags.length,
    byCategory,
    byOfficer: Object.entries(byOfficer).map(([id, data]) => ({ id, ...data })),
  });
});
