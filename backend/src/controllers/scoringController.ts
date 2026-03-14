import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { scoreCustomer, ScoringInput, BenchmarkComparison } from '../services/creditScoring';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';
import { generateScoreNarrative } from './aiController';

const manualScoringSchema = z.object({
  // Geographic (optional – used for benchmark lookup)
  county: z.string().optional(),
  region: z.string().optional(),
  // Cash Flow
  monthlyFarmIncome: z.number().min(0),
  monthlyOffFarmIncome: z.number().min(0).default(0),
  monthlyHouseholdExpenses: z.number().min(0),
  otherMonthlyDebt: z.number().min(0).default(0),
  mpesaMonthlyAvgKes: z.number().min(0).nullable().optional(),
  hasGroupMembership: z.boolean().default(false),
  groupMonthlySavingsKes: z.number().min(0).nullable().optional(),

  // Ability
  farmSizeAcres: z.number().min(0.1),
  landOwnership: z.enum(['OWNED', 'LEASED', 'COMMUNAL', 'FAMILY']),
  primaryCrop: z.string().min(1),
  secondaryCrops: z.array(z.string()).default([]),
  marketAccess: z.enum(['CONTRACT', 'COOPERATIVE', 'LOCAL_MARKET', 'SUBSISTENCE']),
  irrigationType: z.enum(['IRRIGATED', 'RAIN_FED', 'MIXED']),
  livestockCount: z.number().int().min(0).default(0),

  // Willingness
  yaraMemberSinceYears: z.number().min(0).nullable().optional(),
  yaraProductsUsedCount: z.number().int().min(0).default(0),
  crbStatus: z.enum(['CLEAR', 'LISTED', 'UNKNOWN', 'PERFORMING']).default('UNKNOWN'),
  previousLoansCount: z.number().int().min(0).default(0),
  previousLoansRepaidOnTime: z.boolean().nullable().optional(),
  numberOfDependents: z.number().int().min(0).default(0),

  // Loan request
  requestedAmountKes: z.number().min(1000).max(500_000),
  termMonths: z.number().int().min(1).max(36),
});

/** Score a customer and store result */
export async function runCreditScore(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { customerId } = req.params;

  // Verify customer exists and KYC is at least submitted
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { farmProfile: true, financialProfile: true },
  });

  if (!customer) throw new AppError(404, 'Customer not found');
  if (customer.kycStatus === 'PENDING') {
    throw new AppError(400, 'Customer KYC must be submitted before credit scoring');
  }
  if (customer.amlStatus === 'BLOCKED') {
    throw new AppError(400, 'Customer is AML-blocked. Scoring not permitted.');
  }

  const body = manualScoringSchema.parse(req.body);

  // Pull county/region from the customer record if not overridden in request body
  const county = body.county ?? customer.county ?? undefined;
  const region = body.region ?? customer.yaraRegion ?? undefined;

  const input: ScoringInput = {
    monthlyFarmIncome: body.monthlyFarmIncome,
    monthlyOffFarmIncome: body.monthlyOffFarmIncome,
    monthlyHouseholdExpenses: body.monthlyHouseholdExpenses,
    otherMonthlyDebt: body.otherMonthlyDebt,
    mpesaMonthlyAvgKes: body.mpesaMonthlyAvgKes ?? null,
    hasGroupMembership: body.hasGroupMembership,
    groupMonthlySavingsKes: body.groupMonthlySavingsKes ?? null,
    farmSizeAcres: body.farmSizeAcres,
    landOwnership: body.landOwnership,
    primaryCrop: body.primaryCrop,
    secondaryCrops: body.secondaryCrops,
    marketAccess: body.marketAccess,
    irrigationType: body.irrigationType,
    livestockCount: body.livestockCount,
    yaraMemberSinceYears: body.yaraMemberSinceYears ?? null,
    yaraProductsUsedCount: body.yaraProductsUsedCount,
    crbStatus: body.crbStatus,
    previousLoansCount: body.previousLoansCount,
    previousLoansRepaidOnTime: body.previousLoansRepaidOnTime ?? null,
    numberOfDependents: body.numberOfDependents,
    requestedAmountKes: body.requestedAmountKes,
    termMonths: body.termMonths,
    county,
    region,
  };

  const result = scoreCustomer(input);

  // ─── Benchmark Comparison ────────────────────────────────────────────────────
  // Fetch best-match income benchmarks for crop type and geography
  try {
    const now = new Date();
    const incomeCategories: import('@prisma/client').BenchmarkCategory[] =
      ['CROP_INCOME', 'LIVESTOCK_INCOME', 'LABOUR_WAGES'];

    // Fetch all relevant benchmarks in one query, then stratify in memory
    const allBenchmarks = await prisma.benchmarkValue.findMany({
      where: {
        isActive: true,
        item: { isActive: true, category: { in: incomeCategories } },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
        // Only retrieve rows matching our geography or national scope
        AND: [
          {
            OR: [
              { scope: 'NATIONAL' },
              ...(county ? [{ scope: 'COUNTY' as const, county: { equals: county, mode: 'insensitive' as const } }] : []),
              ...(region ? [{ scope: 'REGION' as const, region: { contains: region, mode: 'insensitive' as const } }] : []),
            ],
          },
        ],
      },
      include: { item: true, source: { select: { id: true, shortName: true } } },
      orderBy: { referenceYear: 'desc' },
    });

    // Sort into tiers so county > region > national deduplication works
    const countyValues = allBenchmarks.filter((v) => v.scope === 'COUNTY');
    const regionValues = allBenchmarks.filter((v) => v.scope === 'REGION');
    const nationalValues = allBenchmarks.filter((v) => v.scope === 'NATIONAL');

    // Merge: county > region > national, deduplicate by itemId
    const seen = new Set<string>();
    const merged: typeof nationalValues = [];
    for (const val of [...countyValues, ...regionValues, ...nationalValues]) {
      if (!seen.has(val.itemId)) { seen.add(val.itemId); merged.push(val); }
    }

    // Annual stated income for comparison (farm income annualised)
    const statedAnnualFarm = body.monthlyFarmIncome * 12;

    const comparisons: BenchmarkComparison[] = [];
    let penalty = 0;

    for (const bv of merged) {
      // Normalise benchmark to annual KES for comparison
      let benchAnnualLow = bv.valueLow;
      let benchAnnualMid = bv.valueMid;
      let benchAnnualHigh = bv.valueHigh;

      const itemType = bv.item.itemType;
      if (itemType === 'MONTHLY_INCOME') {
        benchAnnualLow  *= 12;
        benchAnnualMid  *= 12;
        benchAnnualHigh *= 12;
      }
      // INCOME_PER_UNIT and ANNUAL_EXPENSE already annual; WAGE_RATE per month → annualise
      if (itemType === 'WAGE_RATE') {
        benchAnnualLow  *= 12;
        benchAnnualMid  *= 12;
        benchAnnualHigh *= 12;
      }

      // Scale INCOME_PER_UNIT by farm size (acres)
      if (itemType === 'INCOME_PER_UNIT') {
        benchAnnualLow  *= body.farmSizeAcres;
        benchAnnualMid  *= body.farmSizeAcres;
        benchAnnualHigh *= body.farmSizeAcres;
      }

      const deviationPct = benchAnnualMid > 0
        ? ((statedAnnualFarm - benchAnnualMid) / benchAnnualMid) * 100
        : 0;

      // Flag if stated income > 150% of benchmark high (>50% above ceiling)
      const flagged = statedAnnualFarm > benchAnnualHigh * 1.5;
      if (flagged && penalty === 0) {
        penalty = 3;
        result.scoringNotes.push(
          `⚠ Benchmark flag: Stated annual farm income (KES ${statedAnnualFarm.toLocaleString()}) is more than 50% above the benchmark high for ${bv.item.name} (KES ${Math.round(benchAnnualHigh).toLocaleString()}). Income reliability penalty of -3 pts applied.`
        );
      }

      comparisons.push({
        itemName: bv.item.name,
        category: bv.item.category,
        statedMonthlyKes: body.monthlyFarmIncome,
        benchmarkLowKes: Math.round(benchAnnualLow / 12),
        benchmarkMidKes: Math.round(benchAnnualMid / 12),
        benchmarkHighKes: Math.round(benchAnnualHigh / 12),
        deviationPct: Math.round(deviationPct),
        flagged,
        scope: bv.scope,
        sourceShortName: bv.source.shortName,
        referenceYear: bv.referenceYear,
      });
    }

    // Apply penalty to cashflow score
    if (penalty > 0) {
      result.cashflowScore = Math.max(0, result.cashflowScore - penalty);
      result.totalScore = result.cashflowScore + result.abilityScore + result.willingnessScore;
      // Re-evaluate recommendation after penalty
      if (result.totalScore >= 70) result.recommendation = 'APPROVE';
      else if (result.totalScore >= 50) result.recommendation = 'CONDITIONAL';
      else if (result.totalScore >= 30) result.recommendation = 'DECLINE';
      else result.recommendation = 'STRONG_DECLINE';
    }

    result.benchmarkComparisons = comparisons;
    result.benchmarkPenaltyApplied = penalty;
  } catch {
    // Benchmark lookup is non-critical – scoring still proceeds
  }

  // Persist the score
  const creditScore = await prisma.creditScore.create({
    data: {
      customerId,
      cashflowScore: result.cashflowScore,
      cashflowBreakdown: result.cashflowBreakdown as never,
      abilityScore: result.abilityScore,
      abilityBreakdown: result.abilityBreakdown as never,
      willingnessScore: result.willingnessScore,
      willingnessBreakdown: result.willingnessBreakdown as never,
      totalScore: result.totalScore,
      recommendation: result.recommendation,
      maxLoanAmountKes: result.maxLoanAmountKes,
      suggestedTermMonths: result.suggestedTermMonths,
      scoringNotes: result.scoringNotes.join('\n'),
      inputSnapshot: input as never,
      scoredByUserId: req.user.sub,
    },
  });

  await writeAuditLog(req.user.sub, 'RUN_CREDIT_SCORE', 'credit_scores', creditScore.id, req);

  // AI narrative — non-blocking, empty string if AI is unavailable
  const narrative = await generateScoreNarrative({
    totalScore: result.totalScore,
    cashflowScore: result.cashflowScore,
    abilityScore: result.abilityScore,
    willingnessScore: result.willingnessScore,
    recommendation: result.recommendation,
    scoringNotes: result.scoringNotes,
    requestedAmountKes: input.requestedAmountKes,
    maxLoanAmountKes: result.maxLoanAmountKes,
    primaryCrop: input.primaryCrop,
    county: input.county,
  });

  res.status(201).json({ ...result, creditScoreId: creditScore.id, narrative: narrative || undefined });
}

/** Get scoring history for a customer */
export async function getCustomerScores(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { customerId } = req.params;

  const scores = await prisma.creditScore.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });

  await writeAuditLog(req.user.sub, 'LIST_CREDIT_SCORES', 'credit_scores', customerId, req);
  res.json(scores);
}
