/**
 * Data Quality & Duplicate Detection Service
 *
 * Implements microfinance-grade checks based on industry best practice:
 *   • Jaro-Winkler similarity for name fuzzy matching
 *   • Jaccard word-set similarity for copy-paste loan purpose detection
 *   • Haversine GPS proximity clustering
 *   • Financial profile fingerprinting (copy-paste income/expense)
 *   • Round-number income heuristics
 *   • Implausible income/expense ratio detection
 *   • Rapid application succession detection
 *   • Generic/template loan purpose detection
 */

import { prisma } from '../config/database';
import { QualityFlagType, FlagSeverity, Prisma } from '@prisma/client';
import { configService } from './configService';

// ─── String similarity ─────────────────────────────────────────────────────────

/** Jaro similarity score [0,1] */
function jaro(a: string, b: string): number {
  if (a === b) return 1;
  const lenA = a.length, lenB = b.length;
  if (lenA === 0 || lenB === 0) return 0;
  const matchDist = Math.max(Math.floor(Math.max(lenA, lenB) / 2) - 1, 0);
  const aMatched = new Array(lenA).fill(false);
  const bMatched = new Array(lenB).fill(false);
  let matches = 0;
  for (let i = 0; i < lenA; i++) {
    const lo = Math.max(0, i - matchDist);
    const hi = Math.min(i + matchDist + 1, lenB);
    for (let j = lo; j < hi; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < lenA; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  return (matches / lenA + matches / lenB + (matches - transpositions / 2) / matches) / 3;
}

/** Jaro-Winkler similarity (gives extra credit for common prefix) */
export function jaroWinkler(a: string, b: string, p = 0.1): number {
  const j = jaro(a, b);
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return j + prefix * p * (1 - j);
}

/**
 * Full-name similarity: compare normalised full names (handles swapped
 * first/last name which is common in rural Kenya).
 */
export function nameSimilarity(
  fn1: string, ln1: string,
  fn2: string, ln2: string,
): number {
  const norm = (s: string) => s.trim().toLowerCase();
  const full1 = `${norm(fn1)} ${norm(ln1)}`;
  const full2 = `${norm(fn2)} ${norm(ln2)}`;
  const swapped2 = `${norm(ln2)} ${norm(fn2)}`;
  return Math.max(jaroWinkler(full1, full2), jaroWinkler(full1, swapped2));
}

// ─── Text similarity ───────────────────────────────────────────────────────────

/** Jaccard similarity on word bags (stop-words stripped) */
const STOP_WORDS = new Set([
  'a','an','the','to','for','of','in','on','and','or','is','i','my','me',
  'we','our','this','that','with','will','be','as','at','by','loan','buy',
  'purchase','get','need','want','farm','business',
]);

export function jaccardSimilarity(text1: string, text2: string): number {
  const words = (t: string) =>
    new Set(
      t.toLowerCase()
        .split(/\W+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w)),
    );
  const w1 = words(text1);
  const w2 = words(text2);
  const intersect = [...w1].filter(w => w2.has(w)).length;
  const union = new Set([...w1, ...w2]).size;
  return union === 0 ? 0 : intersect / union;
}

// ─── Geography ────────────────────────────────────────────────────────────────

/** Haversine distance in metres */
export function haversineMetres(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Round-number heuristic ───────────────────────────────────────────────────

/**
 * Returns true when a monetary value is "suspiciously round" –
 * i.e. divisible by 1000 with ≥ 3 trailing zeros.
 * Values of 0 are excluded (they may legitimately be zero).
 */
export function isRoundNumber(value: number): boolean {
  return value > 0 && value % 1000 === 0;
}

/** Count of round fields out of the key income/expense fields */
function roundFieldScore(fp: {
  monthlyFarmIncome: number;
  monthlyOffFarmIncome: number;
  monthlyHouseholdExpenses: number;
  otherMonthlyDebt: number;
}): number {
  return [
    fp.monthlyFarmIncome,
    fp.monthlyOffFarmIncome,
    fp.monthlyHouseholdExpenses,
    fp.otherMonthlyDebt,
  ].filter(isRoundNumber).length;
}

// ─── Known template phrases ────────────────────────────────────────────────────

const TEMPLATE_PHRASES = [
  'purchase inputs for the farm',
  'buy seeds and fertilizer',
  'expand my farming activities',
  'purchase farm inputs',
  'to improve my farm',
  'buying agricultural inputs',
  'to buy farm inputs',
  'business expansion',
  'general business',
  'working capital',
];

function isGenericPurpose(purpose: string): boolean {
  const lower = purpose.trim().toLowerCase();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  if (wordCount < 12) return true;
  return TEMPLATE_PHRASES.some(phrase => lower.includes(phrase));
}

// ─── Flag upsert helper ────────────────────────────────────────────────────────

type FlagInput = {
  entityType: string;
  entityId: string;
  flagType: QualityFlagType;
  severity: FlagSeverity;
  message: string;
  details?: Record<string, unknown>;
};

async function upsertFlag(f: FlagInput): Promise<void> {
  // One active (unresolved) flag per entity+type; update message/details if changed
  const existing = await prisma.dataQualityFlag.findFirst({
    where: { entityType: f.entityType, entityId: f.entityId, flagType: f.flagType, isResolved: false },
    select: { id: true },
  });
  if (existing) {
    await prisma.dataQualityFlag.update({
      where: { id: existing.id },
      data: { message: f.message, details: f.details as Prisma.InputJsonValue },
    });
  } else {
    await prisma.dataQualityFlag.create({
      data: {
        entityType: f.entityType,
        entityId: f.entityId,
        flagType: f.flagType,
        severity: f.severity,
        message: f.message,
        details: f.details as Prisma.InputJsonValue,
      },
    });
  }
}

async function clearFlag(entityId: string, flagType: QualityFlagType): Promise<void> {
  await prisma.dataQualityFlag.updateMany({
    where: { entityId, flagType, isResolved: false },
    data: { isResolved: true, resolvedAt: new Date(), resolvedNote: 'auto-cleared' },
  });
}

// ─── Customer quality checks ───────────────────────────────────────────────────

/** Pre-check: fast name/DOB search — used by the onboarding form before creation */
export async function findNameDuplicates(
  firstName: string,
  lastName: string,
  dateOfBirth: Date | null,
  excludeCustomerId?: string,
): Promise<Array<{
  id: string; firstName: string; lastName: string;
  county: string; village: string; branchId: string; similarity: number;
}>> {
  const nameCrossBranchThreshold = configService.num('quality.name_sim.cross_branch_threshold') / 100;
  const dobWindowDays            = configService.int('quality.dob_window_days');

  // Load all customers with only the fields we need for comparison
  const candidates = await prisma.customer.findMany({
    where: {
      isActive: true,
      ...(excludeCustomerId ? { id: { not: excludeCustomerId } } : {}),
    },
    select: {
      id: true, firstName: true, lastName: true,
      dateOfBirth: true, county: true, village: true, branchId: true,
    },
  });

  const results = [];
  for (const c of candidates) {
    const sim = nameSimilarity(firstName, lastName, c.firstName, c.lastName);
    if (sim < nameCrossBranchThreshold) continue;

    // Boost match score if DOB is close
    let finalSim = sim;
    if (dateOfBirth && c.dateOfBirth) {
      const diffDays = Math.abs(
        (dateOfBirth.getTime() - c.dateOfBirth.getTime()) / 86_400_000,
      );
      if (diffDays <= dobWindowDays) finalSim = Math.min(1, sim + 0.05);
    }

    results.push({ ...c, similarity: Math.round(finalSim * 100) / 100 });
  }

  return results
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

export async function runCustomerChecks(customerId: string): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { financialProfile: true },
  });
  if (!customer) return;

  const nameSameBranchThreshold  = configService.num('quality.name_sim.same_branch_threshold') / 100;
  const nameCrossBranchThreshold = configService.num('quality.name_sim.cross_branch_threshold') / 100;
  const dobWindowDays            = configService.int('quality.dob_window_days');
  const gpsRadiusMetres          = configService.num('quality.gps_radius_metres');
  const debtServiceRatioPct      = configService.num('quality.debt_service_ratio_pct') / 100;
  const roundFieldCount          = configService.int('quality.round_field_count');

  // ── 1. Fuzzy name duplicates ───────────────────────────────────────────────
  const nameMatches = await findNameDuplicates(
    customer.firstName, customer.lastName, customer.dateOfBirth, customerId,
  );

  // Clear stale flags first
  await clearFlag(customerId, 'SIMILAR_NAME_SAME_BRANCH' as QualityFlagType);
  await clearFlag(customerId, 'SIMILAR_NAME_CROSS_BRANCH' as QualityFlagType);
  await clearFlag(customerId, 'NAME_DOB_MATCH' as QualityFlagType);

  for (const match of nameMatches) {
    const sameBranch = match.branchId === customer.branchId;
    const dobMatch =
      customer.dateOfBirth &&
      Math.abs(
        (customer.dateOfBirth.getTime() - (match as { dateOfBirth?: Date }).dateOfBirth!.getTime()) / 86_400_000,
      ) <= dobWindowDays;

    if (dobMatch && match.similarity >= nameCrossBranchThreshold) {
      await upsertFlag({
        entityType: 'CUSTOMER', entityId: customerId,
        flagType: 'NAME_DOB_MATCH' as QualityFlagType,
        severity: 'CRITICAL' as FlagSeverity,
        message: `Name AND date-of-birth closely match existing customer ${match.firstName} ${match.lastName} (${match.similarity * 100 | 0}% name similarity, DOB within 1 year). Possible duplicate.`,
        details: { matchedId: match.id, matchedName: `${match.firstName} ${match.lastName}`, similarity: match.similarity, sameBranch },
      });
    } else if (sameBranch && match.similarity >= nameSameBranchThreshold) {
      await upsertFlag({
        entityType: 'CUSTOMER', entityId: customerId,
        flagType: 'SIMILAR_NAME_SAME_BRANCH' as QualityFlagType,
        severity: 'WARNING' as FlagSeverity,
        message: `Name closely matches ${match.firstName} ${match.lastName} in the same branch (${match.similarity * 100 | 0}% similarity). Verify this is not a duplicate.`,
        details: { matchedId: match.id, matchedName: `${match.firstName} ${match.lastName}`, similarity: match.similarity },
      });
    } else if (!sameBranch && match.similarity >= nameCrossBranchThreshold) {
      await upsertFlag({
        entityType: 'CUSTOMER', entityId: customerId,
        flagType: 'SIMILAR_NAME_CROSS_BRANCH' as QualityFlagType,
        severity: 'INFO' as FlagSeverity,
        message: `Name closely matches ${match.firstName} ${match.lastName} in another branch (${match.similarity * 100 | 0}% similarity).`,
        details: { matchedId: match.id, matchedName: `${match.firstName} ${match.lastName}`, similarity: match.similarity },
      });
    }
  }

  // ── 2. GPS proximity ──────────────────────────────────────────────────────
  await clearFlag(customerId, 'GPS_PROXIMITY' as QualityFlagType);
  if (customer.gpsLatitude !== null && customer.gpsLongitude !== null) {
    // Fetch customers registered near the same location
    const nearby = await prisma.customer.findMany({
      where: {
        id: { not: customerId },
        isActive: true,
        gpsLatitude: { not: null },
        gpsLongitude: { not: null },
        // Rough bounding box (±0.001° ≈ 110 m) to limit candidates before precise calc
        AND: [
          { gpsLatitude:  { gte: customer.gpsLatitude  - 0.001, lte: customer.gpsLatitude  + 0.001 } },
          { gpsLongitude: { gte: customer.gpsLongitude - 0.001, lte: customer.gpsLongitude + 0.001 } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, gpsLatitude: true, gpsLongitude: true },
    });

    for (const n of nearby) {
      if (n.gpsLatitude === null || n.gpsLongitude === null) continue;
      const dist = haversineMetres(
        customer.gpsLatitude, customer.gpsLongitude,
        n.gpsLatitude, n.gpsLongitude,
      );
      if (dist <= gpsRadiusMetres) {
        await upsertFlag({
          entityType: 'CUSTOMER', entityId: customerId,
          flagType: 'GPS_PROXIMITY' as QualityFlagType,
          severity: 'WARNING' as FlagSeverity,
          message: `GPS coordinates are within ${Math.round(dist)} m of ${n.firstName} ${n.lastName}. Verify these are distinct individuals, not the same person registered twice.`,
          details: { matchedId: n.id, matchedName: `${n.firstName} ${n.lastName}`, distanceMetres: Math.round(dist) },
        });
        break; // Flag once even if multiple nearby
      }
    }
  }

  // ── 3. Financial profile copy-paste ───────────────────────────────────────
  await clearFlag(customerId, 'FINANCIAL_PROFILE_COPY' as QualityFlagType);
  if (customer.financialProfile) {
    const fp = customer.financialProfile;
    if (fp.monthlyFarmIncome > 0) {
      // Look for other customers with identical key financial values created by same LO
      const loApps = await prisma.loanApplication.findMany({
        where: { officerId: { not: undefined } },
        select: { customerId: true, officerId: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      // Customers this LO has registered (via their applications)
      const loCustomerIds = [
        ...new Set(loApps.map(a => a.customerId).filter(id => id !== customerId)),
      ];

      if (loCustomerIds.length > 0) {
        const matches = await prisma.financialProfile.findMany({
          where: {
            customerId: { in: loCustomerIds },
            monthlyFarmIncome: fp.monthlyFarmIncome,
            monthlyHouseholdExpenses: fp.monthlyHouseholdExpenses,
            otherMonthlyDebt: fp.otherMonthlyDebt,
          },
          select: { customerId: true, customer: { select: { firstName: true, lastName: true } } },
        });

        if (matches.length > 0) {
          const names = matches.slice(0, 3).map(m => `${m.customer.firstName} ${m.customer.lastName}`).join(', ');
          await upsertFlag({
            entityType: 'CUSTOMER', entityId: customerId,
            flagType: 'FINANCIAL_PROFILE_COPY' as QualityFlagType,
            severity: 'CRITICAL' as FlagSeverity,
            message: `Financial profile (farm income KES ${fp.monthlyFarmIncome.toLocaleString()}, expenses KES ${fp.monthlyHouseholdExpenses.toLocaleString()}) is identical to ${matches.length} other customer(s): ${names}. This is a strong indicator of copy-paste.`,
            details: { matchedCustomerIds: matches.map(m => m.customerId), count: matches.length },
          });
        }
      }
    }
  }

  // ── 4. Round-number income ────────────────────────────────────────────────
  await clearFlag(customerId, 'ROUND_NUMBER_INCOME' as QualityFlagType);
  if (customer.financialProfile) {
    const roundCount = roundFieldScore(customer.financialProfile);
    if (roundCount >= roundFieldCount) {
      await upsertFlag({
        entityType: 'CUSTOMER', entityId: customerId,
        flagType: 'ROUND_NUMBER_INCOME' as QualityFlagType,
        severity: 'INFO' as FlagSeverity,
        message: `${roundCount} of 4 income/expense fields are round multiples of 1,000 (farm income, off-farm income, household expenses, other debt). Real-world figures rarely align this neatly — verify with the customer.`,
        details: {
          monthlyFarmIncome: customer.financialProfile.monthlyFarmIncome,
          monthlyOffFarmIncome: customer.financialProfile.monthlyOffFarmIncome,
          monthlyHouseholdExpenses: customer.financialProfile.monthlyHouseholdExpenses,
          otherMonthlyDebt: customer.financialProfile.otherMonthlyDebt,
          roundCount,
        },
      });
    }
  }

  // ── 5. Negative disposable income ────────────────────────────────────────
  await clearFlag(customerId, 'NEGATIVE_DISPOSABLE_INCOME' as QualityFlagType);
  await clearFlag(customerId, 'HIGH_DEBT_BURDEN' as QualityFlagType);
  if (customer.financialProfile) {
    const fp = customer.financialProfile;
    const totalIncome = fp.monthlyFarmIncome + fp.monthlyOffFarmIncome;
    const totalOut = fp.monthlyHouseholdExpenses + fp.otherMonthlyDebt;

    if (totalOut > totalIncome && totalIncome > 0) {
      await upsertFlag({
        entityType: 'CUSTOMER', entityId: customerId,
        flagType: 'NEGATIVE_DISPOSABLE_INCOME' as QualityFlagType,
        severity: 'WARNING' as FlagSeverity,
        message: `Stated monthly expenses (KES ${totalOut.toLocaleString()}) exceed stated monthly income (KES ${totalIncome.toLocaleString()}). Either income is understated or expenses are overstated.`,
        details: { totalIncome, totalOut, deficit: totalOut - totalIncome },
      });
    } else if (totalIncome > 0) {
      const debtService = fp.otherMonthlyDebt;
      const disposable = totalIncome - fp.monthlyHouseholdExpenses;
      if (disposable > 0 && debtService / disposable > debtServiceRatioPct) {
        await upsertFlag({
          entityType: 'CUSTOMER', entityId: customerId,
          flagType: 'HIGH_DEBT_BURDEN' as QualityFlagType,
          severity: 'WARNING' as FlagSeverity,
          message: `Existing debt service (KES ${debtService.toLocaleString()}/mo) consumes ${((debtService / disposable) * 100).toFixed(0)}% of disposable income — above the ${Math.round(debtServiceRatioPct * 100)}% threshold.`,
          details: { debtService, disposable, ratio: debtService / disposable },
        });
      }
    }
  }
}

// ─── Loan application quality checks ──────────────────────────────────────────

export async function runApplicationChecks(applicationId: string): Promise<void> {
  const app = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: {
      customer: { include: { financialProfile: true } },
    },
  });
  if (!app) return;

  const jaccardThreshold    = configService.num('quality.jaccard_threshold_pct') / 100;
  const rapidWindowMin      = configService.num('quality.rapid_app_window_minutes');
  const rapidCountMax       = configService.int('quality.rapid_app_count_max');
  const lookbackWindowDays  = configService.int('quality.lookback_window_days');
  const debtServiceRatioPct = configService.num('quality.debt_service_ratio_pct') / 100;
  const roundFieldCount     = configService.int('quality.round_field_count');

  // ── A. Copy-paste loan purpose ─────────────────────────────────────────────
  await clearFlag(applicationId, 'LOAN_PURPOSE_COPY_PASTE' as QualityFlagType);
  const windowStart = new Date(Date.now() - lookbackWindowDays * 86_400_000);
  const recentApps = await prisma.loanApplication.findMany({
    where: {
      officerId: app.officerId,
      id: { not: applicationId },
      createdAt: { gte: windowStart },
    },
    select: { id: true, purposeOfLoan: true, customerId: true },
  });

  let maxSim = 0;
  let maxSimApp: { id: string; customerId: string } | null = null;
  for (const other of recentApps) {
    const sim = jaccardSimilarity(app.purposeOfLoan, other.purposeOfLoan);
    if (sim > maxSim) { maxSim = sim; maxSimApp = other; }
  }

  if (maxSim >= jaccardThreshold && maxSimApp) {
    await upsertFlag({
      entityType: 'LOAN_APPLICATION', entityId: applicationId,
      flagType: 'LOAN_PURPOSE_COPY_PASTE' as QualityFlagType,
      severity: 'CRITICAL' as FlagSeverity,
      message: `Loan purpose text is ${(maxSim * 100).toFixed(0)}% similar to another recent application by the same loan officer. This suggests copy-paste. Each customer's purpose must be captured individually.`,
      details: { matchedApplicationId: maxSimApp.id, similarity: Math.round(maxSim * 100) / 100 },
    });
  }

  // ── B. Generic / template purpose ─────────────────────────────────────────
  await clearFlag(applicationId, 'GENERIC_LOAN_PURPOSE' as QualityFlagType);
  if (isGenericPurpose(app.purposeOfLoan)) {
    await upsertFlag({
      entityType: 'LOAN_APPLICATION', entityId: applicationId,
      flagType: 'GENERIC_LOAN_PURPOSE' as QualityFlagType,
      severity: 'WARNING' as FlagSeverity,
      message: `Loan purpose is too short or uses generic template language ("${app.purposeOfLoan.substring(0, 80)}…"). The loan officer must capture the specific intended use of funds.`,
      details: { wordCount: app.purposeOfLoan.split(/\s+/).filter(Boolean).length, purpose: app.purposeOfLoan.substring(0, 200) },
    });
  }

  // ── C. Rapid succession ────────────────────────────────────────────────────
  await clearFlag(applicationId, 'RAPID_SUCCESSION' as QualityFlagType);
  const rapidStart = new Date(Date.now() - rapidWindowMin * 60_000);
  const rapidCount = await prisma.loanApplication.count({
    where: {
      officerId: app.officerId,
      id: { not: applicationId },
      createdAt: { gte: rapidStart },
    },
  });

  if (rapidCount >= rapidCountMax) {
    await upsertFlag({
      entityType: 'LOAN_APPLICATION', entityId: applicationId,
      flagType: 'RAPID_SUCCESSION' as QualityFlagType,
      severity: 'WARNING' as FlagSeverity,
      message: `${rapidCount} other applications were submitted by the same loan officer in the last ${rapidWindowMin} minutes. Batch submission may indicate insufficient individual assessment.`,
      details: { appsInWindow: rapidCount, windowMinutes: rapidWindowMin },
    });
  }

  // ── D. Negative disposable income (re-check at application time) ──────────
  await clearFlag(applicationId, 'NEGATIVE_DISPOSABLE_INCOME' as QualityFlagType);
  await clearFlag(applicationId, 'HIGH_DEBT_BURDEN' as QualityFlagType);
  if (app.customer.financialProfile) {
    const fp = app.customer.financialProfile;
    const totalIncome = fp.monthlyFarmIncome + fp.monthlyOffFarmIncome;
    const totalOut    = fp.monthlyHouseholdExpenses + fp.otherMonthlyDebt;

    if (totalOut > totalIncome && totalIncome > 0) {
      await upsertFlag({
        entityType: 'LOAN_APPLICATION', entityId: applicationId,
        flagType: 'NEGATIVE_DISPOSABLE_INCOME' as QualityFlagType,
        severity: 'CRITICAL' as FlagSeverity,
        message: `Customer's expenses (KES ${totalOut.toLocaleString()}) exceed income (KES ${totalIncome.toLocaleString()}) — there is no capacity to service this loan based on stated figures.`,
        details: { totalIncome, totalOut },
      });
    } else if (totalIncome > 0) {
      const disposable = totalIncome - fp.monthlyHouseholdExpenses;
      if (disposable > 0 && fp.otherMonthlyDebt / disposable > debtServiceRatioPct) {
        await upsertFlag({
          entityType: 'LOAN_APPLICATION', entityId: applicationId,
          flagType: 'HIGH_DEBT_BURDEN' as QualityFlagType,
          severity: 'WARNING' as FlagSeverity,
          message: `Existing debt service (KES ${fp.otherMonthlyDebt.toLocaleString()}/mo) is ${((fp.otherMonthlyDebt / disposable) * 100).toFixed(0)}% of disposable income before this new loan.`,
          details: { otherDebt: fp.otherMonthlyDebt, disposable },
        });
      }
    }
  }

  // ── E. Round-number income (on application for BCC visibility) ────────────
  await clearFlag(applicationId, 'ROUND_NUMBER_INCOME' as QualityFlagType);
  if (app.customer.financialProfile) {
    const roundCount = roundFieldScore(app.customer.financialProfile);
    if (roundCount >= roundFieldCount) {
      await upsertFlag({
        entityType: 'LOAN_APPLICATION', entityId: applicationId,
        flagType: 'ROUND_NUMBER_INCOME' as QualityFlagType,
        severity: 'INFO' as FlagSeverity,
        message: `${roundCount}/4 income and expense figures are round thousands. The BCC should probe whether these were carefully elicited or estimated.`,
        details: { roundCount },
      });
    }
  }
}

// ─── Convenience: run both customer and application checks ────────────────────

export async function runAllChecksForApplication(applicationId: string): Promise<void> {
  const app = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    select: { customerId: true },
  });
  if (!app) return;
  await Promise.all([
    runCustomerChecks(app.customerId),
    runApplicationChecks(applicationId),
  ]);
}

// ─── Branch quality report ────────────────────────────────────────────────────

export async function getBranchQualityReport(branchId: string | null) {
  // Customers in branch
  const customerIds = await prisma.customer
    .findMany({
      where: branchId ? { branchId, isActive: true } : { isActive: true },
      select: { id: true },
    })
    .then(rows => rows.map(r => r.id));

  // Applications in branch
  const applicationIds = await prisma.loanApplication
    .findMany({
      where: branchId ? { customer: { branchId } } : {},
      select: { id: true },
    })
    .then(rows => rows.map(r => r.id));

  const allEntityIds = [...customerIds, ...applicationIds];
  if (allEntityIds.length === 0) {
    return { totalFlags: 0, bySeverity: {}, byType: {}, byOfficer: [], topFlaggedCustomers: [] };
  }

  const flags = await prisma.dataQualityFlag.findMany({
    where: {
      entityId: { in: allEntityIds },
      isResolved: false,
    },
    select: {
      id: true, entityType: true, entityId: true,
      flagType: true, severity: true, message: true, createdAt: true,
    },
  });

  // Group by severity
  const bySeverity = { CRITICAL: 0, WARNING: 0, INFO: 0 };
  const byType: Record<string, number> = {};
  for (const f of flags) {
    bySeverity[f.severity as keyof typeof bySeverity]++;
    byType[f.flagType] = (byType[f.flagType] ?? 0) + 1;
  }

  // Per-officer stats (requires joining applications → officer)
  const officerApps = await prisma.loanApplication.findMany({
    where: { id: { in: applicationIds } },
    select: {
      id: true,
      officerId: true,
      officer: { select: { firstName: true, lastName: true } },
    },
  });
  const appToOfficer = new Map(officerApps.map(a => [a.id, a]));

  const officerMap: Record<string, { name: string; flags: number; critical: number }> = {};
  for (const f of flags) {
    if (f.entityType !== 'LOAN_APPLICATION') continue;
    const app = appToOfficer.get(f.entityId);
    if (!app) continue;
    const key = app.officerId;
    if (!officerMap[key]) {
      officerMap[key] = {
        name: `${app.officer.firstName} ${app.officer.lastName}`,
        flags: 0, critical: 0,
      };
    }
    officerMap[key].flags++;
    if (f.severity === 'CRITICAL') officerMap[key].critical++;
  }

  const byOfficer = Object.entries(officerMap)
    .map(([id, v]) => ({ officerId: id, ...v }))
    .sort((a, b) => b.critical - a.critical || b.flags - a.flags);

  // Top flagged customers
  const custFlagCount: Record<string, number> = {};
  for (const f of flags) {
    if (f.entityType === 'CUSTOMER') {
      custFlagCount[f.entityId] = (custFlagCount[f.entityId] ?? 0) + 1;
    }
  }
  const topCustomerIds = Object.entries(custFlagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id);

  const topCustomers = await prisma.customer.findMany({
    where: { id: { in: topCustomerIds } },
    select: { id: true, firstName: true, lastName: true, county: true },
  });

  const topFlaggedCustomers = topCustomers.map(c => ({
    ...c, flagCount: custFlagCount[c.id] ?? 0,
  }));

  return {
    totalFlags: flags.length,
    bySeverity,
    byType,
    byOfficer,
    topFlaggedCustomers,
  };
}
