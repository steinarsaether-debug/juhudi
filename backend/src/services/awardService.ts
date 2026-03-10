/**
 * Award / Loyalty Tier Service
 *
 * Computes customer loyalty tiers based on completed loan history and applies
 * risk-based interest rate and processing fee discounts.
 *
 * Tier table:
 *   STANDARD  – 0–1 completed cycles, or any write-off in history
 *   BRONZE    – ≥2 cycles, max arrears ≤30d  → −0.5% rate / −10% fee
 *   SILVER    – ≥3 cycles, max arrears ≤14d  → −1.0% rate / −20% fee
 *   GOLD      – ≥5 cycles, max arrears ≤7d   → −1.5% rate / −30% fee
 *   PLATINUM  – ≥7 cycles, max arrears = 0d  → −2.0% rate / −40% fee
 */
import { prisma } from '../config/database';
import { configService } from './configService';

export type CustomerTier = 'STANDARD' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

interface TierDiscount {
  rateDiscount: number;   // percentage points reduction e.g. 0.5 = -0.5% p.a.
  feeDiscount:  number;   // percentage reduction e.g. 10 = -10%
}

function getTierDiscountsFromConfig(tier: CustomerTier): TierDiscount {
  if (tier === 'STANDARD') return { rateDiscount: 0, feeDiscount: 0 };
  return {
    rateDiscount: configService.num(`award.${tier.toLowerCase()}.rate_discount`),
    feeDiscount:  configService.num(`award.${tier.toLowerCase()}.fee_discount`),
  };
}

/** Tier thresholds — evaluated top-down (PLATINUM first) */
function getTierThresholdsFromConfig(): Array<{ tier: CustomerTier; minCycles: number; maxArrears: number }> {
  return [
    { tier: 'PLATINUM', minCycles: configService.int('award.platinum.min_cycles'), maxArrears: configService.int('award.platinum.max_arrears_days') },
    { tier: 'GOLD',     minCycles: configService.int('award.gold.min_cycles'),     maxArrears: configService.int('award.gold.max_arrears_days') },
    { tier: 'SILVER',   minCycles: configService.int('award.silver.min_cycles'),   maxArrears: configService.int('award.silver.max_arrears_days') },
    { tier: 'BRONZE',   minCycles: configService.int('award.bronze.min_cycles'),   maxArrears: configService.int('award.bronze.max_arrears_days') },
  ];
}

/**
 * Compute tier from raw loan data — pure function, no DB calls.
 * @param completedLoans  Loans with status='COMPLETED'
 * @param hasWriteOff     True if the customer has any WRITTEN_OFF loan
 */
export function computeCustomerTier(
  completedLoans: Array<{ daysInArrears: number }>,
  hasWriteOff: boolean,
): CustomerTier {
  if (hasWriteOff) return 'STANDARD';

  const cycleCount = completedLoans.length;
  if (cycleCount < 2) return 'STANDARD';

  const maxArrears = completedLoans.reduce(
    (max, l) => Math.max(max, l.daysInArrears),
    0,
  );

  for (const t of getTierThresholdsFromConfig()) {
    if (cycleCount >= t.minCycles && maxArrears <= t.maxArrears) {
      return t.tier;
    }
  }

  return 'STANDARD';
}

/**
 * Return discount amounts for a given tier.
 */
export function getTierDiscounts(tier: CustomerTier): TierDiscount {
  return getTierDiscountsFromConfig(tier);
}

/**
 * Re-compute the customer's tier and persist it to the DB.
 * Call after loan completion or repayment.
 */
export async function refreshCustomerTier(customerId: string): Promise<CustomerTier> {
  const [completedLoans, writtenOff] = await Promise.all([
    prisma.loan.findMany({
      where: { customerId, status: 'COMPLETED' },
      select: { daysInArrears: true },
    }),
    prisma.loan.findFirst({
      where: { customerId, status: 'WRITTEN_OFF' },
      select: { id: true },
    }),
  ]);

  const tier = computeCustomerTier(completedLoans, !!writtenOff);

  await prisma.customer.update({
    where:  { id: customerId },
    data:   { currentTier: tier, tierUpdatedAt: new Date() },
  });

  return tier;
}

/**
 * Fetch current tier for a customer along with summary stats.
 * Used by the GET /customers/:id/tier endpoint.
 */
export async function getCustomerTierSummary(customerId: string) {
  const [completedLoans, writtenOff, customer] = await Promise.all([
    prisma.loan.findMany({
      where:  { customerId, status: 'COMPLETED' },
      select: { daysInArrears: true },
    }),
    prisma.loan.findFirst({
      where:  { customerId, status: 'WRITTEN_OFF' },
      select: { id: true },
    }),
    prisma.customer.findUnique({
      where:  { id: customerId },
      select: { currentTier: true, tierUpdatedAt: true },
    }),
  ]);

  const tier = customer?.currentTier ?? 'STANDARD';
  const maxArrearsDays = completedLoans.reduce(
    (max, l) => Math.max(max, l.daysInArrears),
    0,
  );

  return {
    tier,
    updatedAt:       customer?.tierUpdatedAt ?? null,
    completedCycles: completedLoans.length,
    hasWriteOff:     !!writtenOff,
    maxArrearsDays,
    discounts:       getTierDiscounts(tier as CustomerTier),
  };
}
