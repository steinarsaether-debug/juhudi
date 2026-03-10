import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';
import { asyncHandler } from '../utils/asyncHandler';
import { configService } from '../services/configService';

// ─── Section weights (read from system_configs at scoring time) ──────────────

function getSectionWeights(): Record<string, number> {
  return {
    s1: configService.int('interview.weight.s1_personal'),
    s2: configService.int('interview.weight.s2_farming'),
    s3: configService.int('interview.weight.s3_financial'),
    s4: configService.int('interview.weight.s4_loan_purpose'),
    s5: configService.int('interview.weight.s5_character'),
    s6: configService.int('interview.weight.s6_risks'),
    s7: configService.int('interview.weight.s7_commitment'),
    s8: configService.int('interview.weight.s8_final'),
  };
}

// Questions per section (just the IDs for scoring)
const SECTION_QUESTIONS: Record<string, string[]> = {
  s1: ['q1', 'q2', 'q3'],
  s2: ['q4', 'q5', 'q6', 'q7'],
  s3: ['q8', 'q9', 'q10', 'q11', 'q12', 'q13'],
  s4: ['q14', 'q15', 'q16', 'q17'],
  s5: ['q18', 'q19', 'q20', 'q21'],
  s6: ['q22', 'q23', 'q24'],
  s7: ['q25', 'q26'],
  s8: ['q27', 'q28'],
};

type AnswerMap = Record<string, { score?: number; notes?: string }>;

function deriveRecommendation(pct: number): 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'FURTHER_EVALUATION' | 'DECLINE' {
  if (pct >= configService.num('interview.threshold.approve_pct'))            return 'APPROVE';
  if (pct >= configService.num('interview.threshold.conditional_pct'))        return 'APPROVE_WITH_CONDITIONS';
  if (pct >= configService.num('interview.threshold.further_evaluation_pct')) return 'FURTHER_EVALUATION';
  return 'DECLINE';
}

function calculateScore(answers: AnswerMap): { totalScore: number; maxScore: number; scorePercent: number } {
  const SECTION_WEIGHTS = getSectionWeights();
  let totalScore = 0;
  let maxScore   = 0;

  for (const [section, qIds] of Object.entries(SECTION_QUESTIONS)) {
    const weight = SECTION_WEIGHTS[section] ?? 1;
    for (const qId of qIds) {
      const score = answers[qId]?.score;
      if (score !== undefined && score >= 1 && score <= 5) {
        totalScore += score * weight;
      }
      maxScore += 5 * weight; // max 5 per question × weight
    }
  }

  const scorePercent = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  return { totalScore, maxScore, scorePercent };
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const answerSchema = z.record(
  z.string(),
  z.object({
    score: z.number().min(1).max(5).optional(),
    notes: z.string().max(3000).optional(),
  }),
);

const saveSchema = z.object({
  language:  z.enum(['en', 'sw']).default('en'),
  answers:   answerSchema.default({}),
  loNotes:   z.string().max(5000).optional(),
  status:    z.enum(['DRAFT', 'COMPLETED']).default('DRAFT'),
});

// ─── Create or upsert a draft interview ──────────────────────────────────────

export const upsertInterview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const { customerId } = req.params;
  const body = saveSchema.parse(req.body);

  // Verify customer exists
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) throw new AppError(404, 'Customer not found');

  // Compute score when completing
  let scoring = {};
  if (body.status === 'COMPLETED') {
    const { totalScore, maxScore, scorePercent } = calculateScore(body.answers as AnswerMap);
    const recommendation = deriveRecommendation(scorePercent);
    scoring = {
      totalScore,
      maxScore,
      scorePercent,
      recommendation,
      completedAt: new Date(),
    };
  }

  // Upsert: one DRAFT per customer per LO — replace if exists
  const existing = await prisma.customerInterview.findFirst({
    where: { customerId, conductedById: req.user.sub, status: 'DRAFT' },
    select: { id: true },
  });

  let interview;
  if (existing) {
    interview = await prisma.customerInterview.update({
      where: { id: existing.id },
      data: {
        language: body.language,
        answers:  body.answers,
        loNotes:  body.loNotes,
        status:   body.status,
        ...scoring,
      },
    });
  } else {
    interview = await prisma.customerInterview.create({
      data: {
        customerId,
        conductedById: req.user.sub,
        language: body.language,
        answers:  body.answers,
        loNotes:  body.loNotes,
        status:   body.status,
        ...scoring,
      },
    });
  }

  await writeAuditLog(req.user.sub, 'UPSERT_INTERVIEW', 'customer_interviews', interview.id, req);
  res.status(body.status === 'COMPLETED' ? 200 : 202).json(interview);
});

// ─── List ALL interviews (LO sees their own; BM/Admin see all in branch/system) ──

export const listAllInterviews = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const page  = Math.max(1, parseInt(req.query.page as string ?? '1'));
  const limit = Math.min(100, parseInt(req.query.limit as string ?? '30'));
  const status = req.query.status as string | undefined;
  const search = (req.query.search as string | undefined)?.trim();

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (req.user.role === 'LOAN_OFFICER') where.conductedById = req.user.sub;

  // BM scope to branch
  if (req.user.role === 'BRANCH_MANAGER' && req.user.branchId) {
    where.customer = { branchId: req.user.branchId };
  }
  if (search) {
    where.customer = {
      ...(where.customer as object ?? {}),
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  const [interviews, total] = await Promise.all([
    prisma.customerInterview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip:  (page - 1) * limit,
      take:  limit,
      include: {
        customer:    { select: { id: true, firstName: true, lastName: true, county: true, village: true } },
        conductedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.customerInterview.count({ where }),
  ]);

  res.json({ data: interviews, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

// ─── List interviews for a customer ──────────────────────────────────────────

export const listInterviews = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const { customerId } = req.params;

  const interviews = await prisma.customerInterview.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    include: {
      conductedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });

  res.json(interviews);
});

// ─── Get single interview ─────────────────────────────────────────────────────

export const getInterview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const { interviewId } = req.params;

  const interview = await prisma.customerInterview.findUnique({
    where: { id: interviewId },
    include: {
      conductedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      customer: { select: { id: true, firstName: true, lastName: true, county: true, village: true } },
    },
  });

  if (!interview) throw new AppError(404, 'Interview not found');
  res.json(interview);
});

// ─── Delete a DRAFT interview ─────────────────────────────────────────────────

export const deleteInterview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const { interviewId } = req.params;

  const interview = await prisma.customerInterview.findUnique({
    where: { id: interviewId },
    select: { id: true, conductedById: true, status: true },
  });

  if (!interview) throw new AppError(404, 'Interview not found');
  if (interview.status === 'COMPLETED') throw new AppError(400, 'Cannot delete a completed interview');
  // LO can only delete their own drafts; BM/Admin can delete any
  if (interview.conductedById !== req.user.sub && !['BRANCH_MANAGER', 'ADMIN'].includes(req.user.role)) {
    throw new AppError(403, 'Not authorised to delete this interview');
  }

  await prisma.customerInterview.delete({ where: { id: interviewId } });
  await writeAuditLog(req.user.sub, 'DELETE_INTERVIEW', 'customer_interviews', interviewId, req);
  res.status(204).send();
});

// ─── ILP Interview endpoints ──────────────────────────────────────────────────

const ILP_SEGMENT_TYPES = ['FARMER', 'LANDLORD', 'SHOP_OWNER'] as const;
type ILPSegmentType = typeof ILP_SEGMENT_TYPES[number];

const ilpSegmentSchema = z.enum(ILP_SEGMENT_TYPES);

const ilpInterviewSchema = z.object({
  answers: z.record(z.string(), z.unknown()),   // { questionId: answer }
  loNotes: z.string().max(5000).optional(),
  status:  z.enum(['DRAFT', 'COMPLETED']).default('DRAFT'),
});

/**
 * POST /interviews/ilp/:customerId/:segment
 * Create or update an ILP interview for a customer + segment.
 * ILP interviews store answers as flat key→value JSON (no scoring).
 */
export const upsertILPInterview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const { customerId } = req.params;
  const segment = ilpSegmentSchema.parse(req.params.segment) as ILPSegmentType;
  const body = ilpInterviewSchema.parse(req.body);

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) throw new AppError(404, 'Customer not found');

  const interviewType = `ILP_${segment}`;

  // Find existing DRAFT for this LO + customer + segment
  const existing = await prisma.customerInterview.findFirst({
    where: { customerId, conductedById: req.user.sub, status: 'DRAFT', interviewType },
    select: { id: true },
  });

  const extra = body.status === 'COMPLETED' ? { completedAt: new Date() } : {};

  // Cast answers to satisfy Prisma's InputJsonValue constraint
  const j = <T>(v: T) => v as unknown as ReturnType<typeof JSON.parse>;

  let interview;
  if (existing) {
    interview = await prisma.customerInterview.update({
      where: { id: existing.id },
      data: {
        answers:  j(body.answers),
        loNotes:  body.loNotes,
        status:   body.status,
        ...extra,
      },
    });
  } else {
    interview = await prisma.customerInterview.create({
      data: {
        customerId,
        conductedById: req.user.sub,
        interviewType,
        ilpSegment:    segment,
        answers:       j(body.answers),
        loNotes:       body.loNotes,
        status:        body.status,
        language:      'en',
        ...extra,
      },
    });
  }

  await writeAuditLog(req.user.sub, 'UPSERT_ILP_INTERVIEW', 'customer_interviews', interview.id, req);
  res.status(body.status === 'COMPLETED' ? 200 : 202).json(interview);
});

/**
 * GET /interviews/ilp/:customerId/:segment
 * Returns the most recent COMPLETED ILP interview for that customer + segment.
 * Used by the ILP wizard Step 0 to gate application entry and pre-populate fields.
 */
export const getILPInterview = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const { customerId } = req.params;
  const segment = ilpSegmentSchema.parse(req.params.segment);

  const interview = await prisma.customerInterview.findFirst({
    where: {
      customerId,
      interviewType: `ILP_${segment}`,
      status: 'COMPLETED',
    },
    orderBy: { completedAt: 'desc' },
    include: {
      conductedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!interview) {
    res.status(404).json({ message: `No completed ILP ${segment} interview found for this customer` });
    return;
  }

  res.json(interview);
});
