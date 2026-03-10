import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';
import { runAllChecksForApplication } from '../services/qualityService';
import { generateFollowUpSchedule } from './ilpController';
import { computeCustomerTier, getTierDiscounts, refreshCustomerTier } from '../services/awardService';
import { deriveKPIFlags, scheduleKPIFollowUps, refreshKPIFlags } from '../services/kpiService';

const collateralItemSchema = z.object({
  collateralType: z.enum([
    'TITLE_DEED', 'MOTOR_VEHICLE', 'CHATTEL', 'LIVESTOCK', 'CROP_LIEN',
    'SALARY_ASSIGNMENT', 'GROUP_GUARANTEE', 'PERSONAL_GUARANTEE',
    'SAVINGS_DEPOSIT', 'OTHER',
  ]),
  description:       z.string().min(3).max(500),
  estimatedValueKes: z.number().min(0),
  documentFileName:  z.string().optional(),
});

const applyLoanSchema = z.object({
  customerId:          z.string().uuid(),
  requestedAmountKes:  z.number().min(1000).max(1_000_000), // raised to 1M for ILP Landlord
  purposeCategory:     z.string().max(60).optional(),
  purposeOfLoan:       z.string().min(10).max(500),
  termMonths:          z.number().int().min(1).max(36),
  loanProductId:       z.string().uuid().optional(),
  creditScoreId:       z.string().uuid().optional(),
  repaymentMethod:     z.enum(['MPESA', 'BANK_TRANSFER', 'CASH']).optional(),

  // Loan type & group
  loanType:            z.enum(['INDIVIDUAL', 'GROUP']).default('INDIVIDUAL'),
  loanGroupId:         z.string().uuid().optional(),
  groupLoanShareKes:   z.number().min(0).optional(),

  // ILP segment (only for individual loans)
  ilpSegment:          z.enum(['FARMER', 'LANDLORD', 'SHOP_OWNER']).optional(),

  // Cash flow snapshot
  monthlyIncomeSnapshot:   z.number().min(0).optional(),
  monthlyExpensesSnapshot: z.number().min(0).optional(),

  // Resilience assessment
  hadShockPastYear:     z.boolean().optional(),
  shockType:            z.string().max(100).optional(),
  copingMechanism:      z.string().max(300).optional(),
  hasSavingsBuffer:     z.boolean().optional(),
  savingsBufferMonths:  z.number().int().min(0).max(60).optional(),
  hasAlternativeIncome: z.boolean().optional(),

  // Collateral items
  collateral:           z.array(collateralItemSchema).max(10).optional(),
});

const reviewLoanSchema = z.object({
  decision: z.enum(['APPROVE', 'CONDITIONALLY_APPROVE', 'REJECT']),
  approvedAmountKes: z.number().min(0).optional(),
  interestRatePct: z.number().min(0).max(100).optional(),
  reviewNotes: z.string().optional(),
  rejectionReason: z.string().optional(),
});

const disburseLoanSchema = z.object({
  disbursementMethod:   z.enum(['MPESA', 'BANK_TRANSFER', 'CASH']),
  disbursementReference: z.string().max(100).optional(),
});

const repaymentSchema = z.object({
  amountKes: z.number().min(1),
  paymentDate: z.string().datetime(),
  method: z.enum(['MPESA', 'BANK_TRANSFER', 'CASH', 'CHEQUE']),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

// ── Number Generators ────────────────────────────────────────────────────────

async function generateApplicationNumber(branchId: string): Promise<string> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { code: true } });
  const code = branch?.code ?? 'GEN';
  const year = new Date().getFullYear();
  const count = await prisma.loanApplication.count({ where: { customer: { branchId } } });
  return `APP-${year}-${code}-${String(count + 1).padStart(5, '0')}`;
}

async function generateLoanNumber(branchId: string): Promise<string> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { code: true } });
  const code = branch?.code ?? 'GEN';
  const year = new Date().getFullYear();
  const count = await prisma.loan.count({ where: { customer: { branchId } } });
  return `LN-${year}-${code}-${String(count + 1).padStart(5, '0')}`;
}

// ── Apply for Loan ────────────────────────────────────────────────────────────

export async function applyForLoan(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const body = applyLoanSchema.parse(req.body);

  // Check customer is KYC-verified and not AML-blocked
  const customer = await prisma.customer.findUnique({
    where: { id: body.customerId },
    select: { id: true, kycStatus: true, amlStatus: true, firstName: true, lastName: true, branchId: true },
  });
  if (!customer) throw new AppError(404, 'Customer not found');
  if (customer.kycStatus !== 'VERIFIED') {
    throw new AppError(400, 'Customer must complete KYC verification before applying for a loan');
  }
  if (customer.amlStatus === 'BLOCKED') {
    throw new AppError(400, 'Customer is AML-blocked. Loan application not permitted.');
  }

  // Ensure at least one completed field interview exists before application
  const completedInterview = await prisma.customerInterview.findFirst({
    where: { customerId: body.customerId, status: 'COMPLETED' },
    select: { id: true },
  });
  if (!completedInterview) {
    throw new AppError(400, 'Customer must have a completed field interview before applying for a loan. Please conduct an interview first.');
  }

  // No concurrent open applications
  const openApp = await prisma.loanApplication.findFirst({
    where: {
      customerId: body.customerId,
      status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
    },
  });
  if (openApp) throw new AppError(409, 'Customer already has an open loan application');

  // Compute customer loyalty tier and apply risk-based discounts
  const [completedLoansForTier, writtenOffLoan] = await Promise.all([
    prisma.loan.findMany({
      where: { customerId: body.customerId, status: 'COMPLETED' },
      select: { daysInArrears: true },
    }),
    prisma.loan.findFirst({
      where: { customerId: body.customerId, status: 'WRITTEN_OFF' },
      select: { id: true },
    }),
  ]);
  const currentTier = computeCustomerTier(completedLoansForTier, !!writtenOffLoan);
  const { rateDiscount, feeDiscount } = getTierDiscounts(currentTier);

  // Group loan validation
  if (body.loanType === 'GROUP') {
    if (!body.loanGroupId) throw new AppError(400, 'loanGroupId is required for group loans');
    const group = await prisma.loanGroup.findUnique({
      where: { id: body.loanGroupId },
      select: { id: true, isActive: true, status: true },
    });
    if (!group || !group.isActive) throw new AppError(404, 'Loan group not found');
    if (group.status === 'DISSOLVED') throw new AppError(400, 'Group is dissolved');

    const membership = await prisma.loanGroupMember.findFirst({
      where: { groupId: body.loanGroupId, customerId: body.customerId, isActive: true },
    });
    if (!membership) {
      throw new AppError(400, 'Customer is not an active member of the specified group');
    }
  }

  // ILP segment eligibility check — officer's branch must have this segment unlocked
  if (body.loanType === 'INDIVIDUAL' && body.ilpSegment) {
    const officer = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { branchId: true },
    });
    if (!officer?.branchId) {
      throw new AppError(400, 'Officer must be assigned to a branch to submit an ILP loan');
    }
    const eligibility = await prisma.branchILPEligibility.findUnique({
      where: { branchId_segment: { branchId: officer.branchId, segment: body.ilpSegment } },
      select: { status: true },
    });
    if (!eligibility || eligibility.status === 'NOT_ELIGIBLE') {
      throw new AppError(
        403,
        `This branch is not eligible to offer ILP ${body.ilpSegment} loans. Contact your Branch Manager.`,
      );
    }
  }

  // Build collateral data
  const collateralItems = body.collateral ?? [];
  // For group loans, automatically add GROUP_GUARANTEE if not already present
  if (body.loanType === 'GROUP' && !collateralItems.some(c => c.collateralType === 'GROUP_GUARANTEE')) {
    collateralItems.push({
      collateralType: 'GROUP_GUARANTEE',
      description: 'Joint liability group guarantee',
      estimatedValueKes: 0,
    });
  }

  const application = await prisma.$transaction(async (tx) => {
    const app = await tx.loanApplication.create({
      data: {
        customerId:              body.customerId,
        officerId:               req.user!.sub,
        applicationNumber:       await generateApplicationNumber(customer.branchId),
        requestedAmountKes:      body.requestedAmountKes,
        purposeCategory:         body.purposeCategory,
        purposeOfLoan:           body.purposeOfLoan,
        termMonths:              body.termMonths,
        loanProductId:           body.loanProductId,
        creditScoreId:           body.creditScoreId,
        repaymentMethod:         body.repaymentMethod,
        loanType:                body.loanType,
        loanGroupId:             body.loanGroupId,
        groupLoanShareKes:       body.groupLoanShareKes,
        ilpSegment:              body.ilpSegment,
        monthlyIncomeSnapshot:   body.monthlyIncomeSnapshot,
        monthlyExpensesSnapshot: body.monthlyExpensesSnapshot,
        hadShockPastYear:        body.hadShockPastYear,
        shockType:               body.shockType,
        copingMechanism:         body.copingMechanism,
        hasSavingsBuffer:        body.hasSavingsBuffer,
        savingsBufferMonths:     body.savingsBufferMonths,
        hasAlternativeIncome:    body.hasAlternativeIncome,
        status:                  'SUBMITTED',
        customerTierAtApplication: currentTier,
        interestRateDiscountPct:   rateDiscount > 0 ? rateDiscount : null,
        processingFeeDiscountPct:  feeDiscount > 0 ? feeDiscount : null,
      },
    });

    if (collateralItems.length > 0) {
      await tx.loanCollateral.createMany({
        data: collateralItems.map(c => ({
          loanApplicationId: app.id,
          collateralType:    c.collateralType,
          description:       c.description,
          estimatedValueKes: c.estimatedValueKes,
          documentFileName:  c.documentFileName,
        })),
      });
    }

    return tx.loanApplication.findUniqueOrThrow({
      where: { id: app.id },
      include: {
        customer:  { select: { firstName: true, lastName: true } },
        officer:   { select: { firstName: true, lastName: true } },
        loanGroup: { select: { name: true } },
        collateral: true,
      },
    });
  });

  await writeAuditLog(req.user.sub, 'CREATE_LOAN_APPLICATION', 'loan_applications', application.id, req);

  // Run quality checks asynchronously — do NOT block the response
  runAllChecksForApplication(application.id).catch(err =>
    console.error('[Quality] application check failed:', err),
  );

  res.status(201).json(application);
}

// ── List Applications ─────────────────────────────────────────────────────────

export async function getLoanApplications(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const skip = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  // ── Role-based scoping ────────────────────────────────────────────────────
  // ADMIN always sees all applications (never branch-scoped).
  // LOAN_OFFICER sees only their own submissions (by officerId).
  // BRANCH_MANAGER / SUPERVISOR see their entire branch PLUS any loan
  //   they personally submitted (handles cross-branch submissions).
  let scopeFilter: Record<string, unknown> = {};
  if (req.user.role === 'LOAN_OFFICER') {
    scopeFilter = { officerId: req.user.sub };
  } else if (req.user.role !== 'ADMIN' && req.user.branchId) {
    scopeFilter = {
      OR: [
        { customer: { branchId: req.user.branchId } },
        { officerId: req.user.sub },
      ],
    };
  }
  // ADMIN (or any role without branchId) → no scope filter → see everything

  const where = {
    ...(status ? { status: status as never } : {}),
    ...scopeFilter,
  };

  const [applications, total] = await Promise.all([
    prisma.loanApplication.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer:  { select: { id: true, firstName: true, lastName: true, county: true } },
        officer:   { select: { firstName: true, lastName: true } },
        creditScore: { select: { totalScore: true, recommendation: true } },
        loanProduct: { select: { name: true, category: true } },
        loanGroup:   { select: { id: true, name: true } },
        collateral:  true,
      },
    }),
    prisma.loanApplication.count({ where }),
  ]);

  res.json({ data: applications, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}

// ── Get Single Application ────────────────────────────────────────────────────

export async function getLoanApplication(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;

  const app = await prisma.loanApplication.findUnique({
    where: { id },
    include: {
      customer:      { select: { id: true, firstName: true, lastName: true, county: true } },
      officer:       { select: { id: true, firstName: true, lastName: true } },
      creditScore:   true,
      loanProduct:   { select: { name: true, category: true } },
      loanGroup:     { select: { id: true, name: true } },
      collateral:    true,
      ilpAssessment: true,
      bccSession:    { select: { id: true, status: true, outcome: true, quorumRequired: true, outcomeNotes: true } },
      loan:          { select: { id: true, loanNumber: true, status: true, disbursedAt: true } },
    },
  });

  if (!app) throw new AppError(404, 'Application not found');

  // LOAN_OFFICER can only view their own submissions
  if (req.user.role === 'LOAN_OFFICER' && app.officerId !== req.user.sub) {
    throw new AppError(403, 'Access denied');
  }

  await writeAuditLog(req.user.sub, 'VIEW_LOAN_APPLICATION', 'loan_applications', id, req);
  res.json(app);
}

// ── Review Application ────────────────────────────────────────────────────────

export async function reviewApplication(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;
  const body = reviewLoanSchema.parse(req.body);

  const app = await prisma.loanApplication.findUnique({ where: { id } });
  if (!app) throw new AppError(404, 'Application not found');
  if (!['SUBMITTED', 'UNDER_REVIEW'].includes(app.status)) {
    throw new AppError(400, `Cannot review application in status: ${app.status}`);
  }

  const statusMap = {
    APPROVE: 'APPROVED',
    CONDITIONALLY_APPROVE: 'CONDITIONALLY_APPROVED',
    REJECT: 'REJECTED',
  } as const;

  const updated = await prisma.loanApplication.update({
    where: { id },
    data: {
      status: statusMap[body.decision],
      approvedAmountKes: body.approvedAmountKes,
      interestRatePct: body.interestRatePct,
      reviewNotes: body.reviewNotes,
      rejectionReason: body.rejectionReason,
      reviewedByUserId: req.user.sub,
      reviewedAt: new Date(),
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  await writeAuditLog(req.user.sub, `${body.decision}_LOAN`, 'loan_applications', id, req);
  res.json(updated);
}

// ── Disburse Loan ─────────────────────────────────────────────────────────────

export async function disburseLoan(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;
  const body = disburseLoanSchema.parse(req.body);

  const app = await prisma.loanApplication.findUnique({
    where: { id },
    include: { loanProduct: true },
  });
  if (!app) throw new AppError(404, 'Application not found');
  if (app.status !== 'APPROVED' && app.status !== 'CONDITIONALLY_APPROVED') {
    throw new AppError(400, 'Only approved applications can be disbursed');
  }
  if (await prisma.loan.findUnique({ where: { applicationId: id } })) {
    throw new AppError(409, 'Loan already disbursed for this application');
  }

  const principal = app.approvedAmountKes ?? app.requestedAmountKes;
  const rate = (app.interestRatePct ?? app.loanProduct?.nominalInterestRate ?? 18) / 100;
  const monthlyRate = rate / 12;
  const term = app.termMonths;

  // Monthly installment using reducing balance formula
  const installment = monthlyRate > 0
    ? (principal * monthlyRate * Math.pow(1 + monthlyRate, term)) /
      (Math.pow(1 + monthlyRate, term) - 1)
    : principal / term;

  const maturityDate = new Date();
  maturityDate.setMonth(maturityDate.getMonth() + term);

  const loanCustomer = await prisma.customer.findUnique({
    where: { id: app.customerId },
    select: { branchId: true },
  });
  const loanNumber = await generateLoanNumber(loanCustomer?.branchId ?? 'unknown');

  const loan = await prisma.loan.create({
    data: {
      applicationId: id,
      customerId: app.customerId,
      loanNumber,
      principalKes: principal,
      interestRatePct: app.interestRatePct ?? 18,
      termMonths: term,
      installmentKes: Math.round(installment),
      totalRepayableKes: Math.round(installment * term),
      disbursementMethod:    body.disbursementMethod,
      disbursementReference: body.disbursementReference,
      disbursedAt:           new Date(),
      maturityDate,
      outstandingBalKes: principal,
      status: 'ACTIVE',
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
    },
  });

  // Update application status
  await prisma.loanApplication.update({ where: { id }, data: { status: 'APPROVED' } });

  await writeAuditLog(req.user.sub, 'DISBURSE_LOAN', 'loans', loan.id, req);

  // Auto-generate ILP follow-up schedule for ILP loans
  if (app.ilpSegment) {
    // Count completed ILP loans for this customer to determine cycle number
    const completedILPLoans = await prisma.loan.count({
      where: {
        customerId: app.customerId,
        status: 'COMPLETED',
        ilpCycleNumber: { not: null },
      },
    });
    const cycleNumber = completedILPLoans + 1;

    // Update loan with cycle number
    await prisma.loan.update({
      where: { id: loan.id },
      data: { ilpCycleNumber: cycleNumber },
    });

    // Generate follow-up schedule asynchronously (don't block response)
    generateFollowUpSchedule(
      loan.id,
      app.ilpSegment,
      cycleNumber,
      new Date(),
      app.termMonths,
    ).catch(err => console.error('[ILP] Follow-up schedule generation failed:', err));

    // Derive and schedule initial KPI monitoring flags
    deriveKPIFlags(loan.id, id).then(async () => {
      await scheduleKPIFollowUps(loan.id, app.ilpSegment!, cycleNumber);
    }).catch(err => console.error('[KPI] Flag derivation failed:', err));
  }

  res.status(201).json(loan);
}

// ── Record Repayment ──────────────────────────────────────────────────────────

export async function recordRepayment(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { loanId } = req.params;
  const body = repaymentSchema.parse(req.body);

  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) throw new AppError(404, 'Loan not found');
  if (loan.status !== 'ACTIVE') throw new AppError(400, 'Loan is not active');

  const repayment = await prisma.repayment.create({
    data: {
      loanId,
      amountKes: body.amountKes,
      paymentDate: new Date(body.paymentDate),
      method: body.method,
      reference: body.reference,
      recordedById: req.user.sub,
      notes: body.notes,
    },
  });

  // Update outstanding balance
  const newBalance = Math.max(0, (loan.outstandingBalKes ?? loan.principalKes) - body.amountKes);
  await prisma.loan.update({
    where: { id: loanId },
    data: {
      outstandingBalKes: newBalance,
      status: newBalance <= 0 ? 'COMPLETED' : 'ACTIVE',
    },
  });

  // Refresh customer loyalty tier after potential cycle completion
  refreshCustomerTier(loan.customerId).catch(err =>
    console.error('[Award] Tier refresh failed:', err),
  );

  // Refresh KPI risk flags for ILP loans
  if (loan.ilpCycleNumber) {
    refreshKPIFlags(loanId).catch(err =>
      console.error('[KPI] Risk flag refresh failed:', err),
    );
  }

  await writeAuditLog(req.user.sub, 'RECORD_REPAYMENT', 'repayments', repayment.id, req);
  res.status(201).json({ ...repayment, newOutstandingBalance: newBalance });
}

// ── Get Loan Detail ───────────────────────────────────────────────────────────

export async function getLoan(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { id } = req.params;

  const loan = await prisma.loan.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, county: true } },
      repayments: { orderBy: { paymentDate: 'desc' } },
      application: {
        select: {
          applicationNumber: true, purposeOfLoan: true,
          ilpSegment: true,
          ilpAssessment: true,
          creditScore: { select: { totalScore: true, recommendation: true } },
        },
      },
    },
  });

  if (!loan) throw new AppError(404, 'Loan not found');
  await writeAuditLog(req.user.sub, 'VIEW_LOAN', 'loans', id, req);
  res.json(loan);
}

// ── Dashboard Stats ────────────────────────────────────────────────────────────

export async function getLoanStats(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const branchFilter = req.user.role === 'LOAN_OFFICER'
    ? { customer: { branchId: req.user.branchId ?? undefined } }
    : req.user.branchId
      ? { customer: { branchId: req.user.branchId } }
      : {};

  const [totalCustomers, pendingKyc, activeLoans, pendingApplications, overdueLoans] =
    await Promise.all([
      prisma.customer.count({ where: { isActive: true, ...branchFilter.customer ? { branchId: branchFilter.customer.branchId } : {} } }),
      prisma.customer.count({ where: { kycStatus: { in: ['PENDING', 'SUBMITTED'] }, ...branchFilter.customer ? { branchId: branchFilter.customer.branchId } : {} } }),
      prisma.loan.count({ where: { status: 'ACTIVE', ...branchFilter } }),
      prisma.loanApplication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }, ...branchFilter } }),
      prisma.loan.count({ where: { status: 'ACTIVE', daysInArrears: { gt: 30 }, ...branchFilter } }),
    ]);

  const portfolioAgg = await prisma.loan.aggregate({
    where: { status: 'ACTIVE', ...branchFilter },
    _sum: { outstandingBalKes: true, principalKes: true },
  });

  res.json({
    totalCustomers,
    pendingKyc,
    activeLoans,
    pendingApplications,
    overdueLoans,
    portfolioOutstandingKes: portfolioAgg._sum.outstandingBalKes ?? 0,
    portfolioPrincipalKes: portfolioAgg._sum.principalKes ?? 0,
  });
}

// ── Enhanced Portfolio Stats (role-aware) ─────────────────────────────────────

export async function getPortfolioStats(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');

  const userId   = req.user.sub;
  const userRole = req.user.role;

  const dbUser = await prisma.user.findUnique({ where: { id: userId } });
  const branchId = dbUser?.branchId ?? null;

  // ── Loan Officer: personal portfolio ──────────────────────────────────────
  if (userRole === 'LOAN_OFFICER') {
    // Filter loans via the application's officerId (Customer has no officerId)
    const loLoanFilter = { application: { officerId: userId } };

    const [myCustomers, myActiveLoans, myPendingApps, myArrears] = await Promise.all([
      // Customers where the LO wrote any application
      prisma.loanApplication.groupBy({ by: ['customerId'], where: { officerId: userId } })
        .then(rows => rows.length),
      prisma.loan.count({ where: { status: 'ACTIVE', ...loLoanFilter } }),
      prisma.loanApplication.count({ where: { status: { in: ['DRAFT', 'SUBMITTED'] }, officerId: userId } }),
      prisma.loan.count({ where: { status: 'ACTIVE', daysInArrears: { gte: 1 }, ...loLoanFilter } }),
    ]);

    const [portfolioAgg, par30Agg] = await Promise.all([
      prisma.loan.aggregate({ where: { status: 'ACTIVE', ...loLoanFilter }, _sum: { outstandingBalKes: true } }),
      prisma.loan.aggregate({ where: { status: 'ACTIVE', daysInArrears: { gte: 30 }, ...loLoanFilter }, _sum: { outstandingBalKes: true } }),
    ]);

    // Open BCC sessions this LO should vote on (their applications)
    const pendingBccVotes = await prisma.bccSession.count({
      where: {
        status: 'OPEN',
        loanApplication: { officerId: userId },
        votes: { none: { userId } },
      },
    });

    const outstanding = portfolioAgg._sum?.outstandingBalKes ?? 0;
    const par30Amount = par30Agg._sum?.outstandingBalKes ?? 0;

    res.json({
      view: 'LOAN_OFFICER',
      myCustomers,
      myActiveLoans,
      myPendingApps,
      myArrears,
      myPortfolioOutstandingKes: outstanding,
      par30Kes: par30Amount,
      par30Rate: outstanding > 0 ? ((par30Amount / outstanding) * 100).toFixed(2) : '0.00',
      pendingBccVotes,
    });
    return;
  }

  // ── Branch Manager / Supervisor: branch overview + per-LO breakdown ────────
  const branchFilter        = branchId ? { customer: { branchId } } : {};
  const branchCustomerFilter = branchId ? { branchId } : {};
  const branchAppFilter     = branchId ? { customer: { branchId } } : {};

  const [totalCustomers, activeLoans, pendingApps, inArrears, openBcc] = await Promise.all([
    prisma.customer.count({ where: { isActive: true, ...branchCustomerFilter } }),
    prisma.loan.count({ where: { status: 'ACTIVE', ...branchFilter } }),
    prisma.loanApplication.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }, ...branchAppFilter } }),
    prisma.loan.count({ where: { status: 'ACTIVE', daysInArrears: { gte: 1 }, ...branchFilter } }),
    prisma.bccSession.count({ where: { status: 'OPEN', ...(branchId ? { branchId } : {}) } }),
  ]);

  const [portfolioAgg, par30Agg] = await Promise.all([
    prisma.loan.aggregate({ where: { status: 'ACTIVE', ...branchFilter }, _sum: { outstandingBalKes: true } }),
    prisma.loan.aggregate({ where: { status: 'ACTIVE', daysInArrears: { gte: 30 }, ...branchFilter }, _sum: { outstandingBalKes: true } }),
  ]);

  // Per-LO breakdown (by applications they wrote)
  const officers = await prisma.user.findMany({
    where: {
      role: 'LOAN_OFFICER',
      isActive: true,
      ...(branchId ? { branchId } : {}),
    },
    select: { id: true, firstName: true, lastName: true },
  });

  const loBreakdown = await Promise.all(officers.map(async (lo) => {
    const loLoanFilter = { application: { officerId: lo.id } };
    const [customers, active, arrears, agg] = await Promise.all([
      prisma.loanApplication.groupBy({ by: ['customerId'], where: { officerId: lo.id } })
        .then(rows => rows.length),
      prisma.loan.count({ where: { status: 'ACTIVE', ...loLoanFilter } }),
      prisma.loan.count({ where: { status: 'ACTIVE', daysInArrears: { gte: 1 }, ...loLoanFilter } }),
      prisma.loan.aggregate({ where: { status: 'ACTIVE', ...loLoanFilter }, _sum: { outstandingBalKes: true } }),
    ]);
    return {
      officerId:    lo.id,
      officerName:  `${lo.firstName} ${lo.lastName}`,
      customers,
      activeLoans:  active,
      inArrears:    arrears,
      portfolioKes: agg._sum?.outstandingBalKes ?? 0,
      parRate:      active > 0 ? ((arrears / active) * 100).toFixed(1) : '0.0',
    };
  }));

  const outstanding = portfolioAgg._sum?.outstandingBalKes ?? 0;
  const par30Amount = par30Agg._sum?.outstandingBalKes ?? 0;

  res.json({
    view: 'BRANCH',
    totalCustomers,
    activeLoans,
    pendingApps,
    inArrears,
    openBccSessions: openBcc,
    portfolioOutstandingKes: outstanding,
    par30Kes: par30Amount,
    par30Rate: outstanding > 0 ? ((par30Amount / outstanding) * 100).toFixed(2) : '0.00',
    loBreakdown,
  });
}
