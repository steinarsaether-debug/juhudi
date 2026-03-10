// ─── ILP Scoring Service ──────────────────────────────────────────────────────
// Pure functions only – no database calls. All scoring is deterministic and
// unit-testable without infrastructure.
//
// Composite score weights:
//   Owner/Character   20%
//   Business Quality  25%
//   Operational Risk  20%
//   Cash Flow         25%
//   Collateral        10%
//
// Thresholds:
//   ≥ 75 → APPROVE
//   60–74 → CONDITIONAL
//   < 60  → DECLINE
// ─────────────────────────────────────────────────────────────────────────────

import { configService } from './configService';

export type CRBStatusInput = 'CLEAR' | 'PERFORMING' | 'UNKNOWN' | 'LISTED';
export type LoanHistoryInput = 'NONE' | 'ON_TIME' | 'SOME_LATE' | 'DEFAULT';
export type MarketAccessInput = 'SUBSISTENCE' | 'LOCAL_MARKET' | 'COOPERATIVE' | 'CONTRACT';
export type IrrigationInput = 'IRRIGATED' | 'MIXED' | 'RAIN_FED';
export type MaintenanceInput = 'GOOD' | 'FAIR' | 'POOR';
export type LocationRatingInput = 'PRIME' | 'GOOD' | 'AVERAGE' | 'POOR';
export type LocationRiskInput = 'LOW' | 'MEDIUM' | 'HIGH';

// ── Owner Score (weight 20%) ──────────────────────────────────────────────────
// Four factors; raw max intentionally > 100 (clamped to 100).

export interface OwnerData {
  experienceYears: number;
  crbStatus: CRBStatusInput;
  loanHistoryType: LoanHistoryInput;
  referenceCount: number;
}

export function computeOwnerScore(data: OwnerData): number {
  let raw = 0;

  // Experience (max 50)
  if (data.experienceYears >= 5)      raw += 50;
  else if (data.experienceYears >= 2) raw += 30;
  else                                raw += 10;

  // CRB status (max 30)
  if (data.crbStatus === 'CLEAR' || data.crbStatus === 'PERFORMING') raw += 30;
  else if (data.crbStatus === 'UNKNOWN')                             raw += 15;
  // LISTED → 0

  // Loan history (max 30)
  if (data.loanHistoryType === 'ON_TIME')      raw += 30;
  else if (data.loanHistoryType === 'NONE' ||
           data.loanHistoryType === 'SOME_LATE') raw += 15;
  // DEFAULT → 0

  // References (max 20)
  if (data.referenceCount >= 2)       raw += 20;
  else if (data.referenceCount === 1) raw += 10;

  return Math.min(100, raw);
}

// ── Business Score – FARMER (weight 25%, raw max 150 → scale to 100) ─────────

export interface FarmerBusinessData {
  farmSizeAcres: number;
  marketAccess: MarketAccessInput;
  groupLoanCycles: number;
}

export function computeFarmerBusinessScore(data: FarmerBusinessData): number {
  let raw = 0;

  // Farm size (max 50)
  if (data.farmSizeAcres >= 5)       raw += 50;
  else if (data.farmSizeAcres >= 3)  raw += 40;
  else if (data.farmSizeAcres >= 1)  raw += 25;
  else                               raw += 10;

  // Market access (max 50)
  const mktMap: Record<MarketAccessInput, number> = {
    CONTRACT: 50, COOPERATIVE: 40, LOCAL_MARKET: 25, SUBSISTENCE: 10,
  };
  raw += mktMap[data.marketAccess] ?? 0;

  // Group loan cycles (max 50)
  if (data.groupLoanCycles >= 3)     raw += 50;
  else if (data.groupLoanCycles >= 2) raw += 35;
  else if (data.groupLoanCycles >= 1) raw += 20;
  else                               raw += 10;

  return Math.round(Math.min(100, (raw / 150) * 100));
}

// ── Business Score – LANDLORD (weight 25%, raw max 150 → scale to 100) ───────
// CRITICAL: no title deed caps the score at 40.

export interface LandlordBusinessData {
  occupancyPct: number;
  unitCount: number;
  titleDeedVerified: boolean;
}

export function computeLandlordBusinessScore(data: LandlordBusinessData): number {
  const cap = data.titleDeedVerified ? 100 : 40;
  let raw = 0;

  // Occupancy (max 50)
  if (data.occupancyPct >= 85)       raw += 50;
  else if (data.occupancyPct >= 70)  raw += 30;
  // < 70% → 0

  // Unit count (max 50)
  if (data.unitCount >= 6)           raw += 50;
  else if (data.unitCount >= 3)      raw += 35;
  else                               raw += 20;

  // Title deed (max 50)
  if (data.titleDeedVerified)        raw += 50;

  const normalized = Math.round(Math.min(100, (raw / 150) * 100));
  return Math.min(cap, normalized);
}

// ── Business Score – SHOP OWNER (weight 25%, raw max 130 → scale to 100) ─────

export interface ShopOwnerBusinessData {
  yearsInBusiness: number;
  hasBusinessLicense: boolean;
  hasBookkeeping: boolean;
  stockVsLoanRatio: number; // stockValueKes / loanAmountKes
}

export function computeShopOwnerBusinessScore(data: ShopOwnerBusinessData): number {
  let raw = 0;

  // Years in business (max 50)
  if (data.yearsInBusiness >= 3)      raw += 50;
  else if (data.yearsInBusiness >= 1) raw += 30;
  else                                raw += 10;

  // Business licence (max 30)
  if (data.hasBusinessLicense)        raw += 30;

  // Has bookkeeping records (max 20)
  if (data.hasBookkeeping)            raw += 20;

  // Stock vs loan ratio (max 30)
  if (data.stockVsLoanRatio >= 2)     raw += 30;
  else if (data.stockVsLoanRatio >= 1) raw += 20;
  // < 1× → 0

  return Math.round(Math.min(100, (raw / 130) * 100));
}

// ── Operational Risk Score – FARMER (weight 20%, direct 0-100) ───────────────
// Four factors × 25 = 100 max.

export interface FarmerOpsData {
  irrigationType: IrrigationInput;
  hasStorage: boolean;
  hasCropInsurance: boolean;
  hasAlternativeIncome: boolean;
}

export function computeFarmerOpsScore(data: FarmerOpsData): number {
  let score = 0;
  if (data.irrigationType === 'IRRIGATED')   score += 25;
  else if (data.irrigationType === 'MIXED')  score += 15;
  // RAIN_FED → 0
  if (data.hasStorage)            score += 25;
  if (data.hasCropInsurance)      score += 25;
  if (data.hasAlternativeIncome)  score += 25;
  return Math.min(100, score);
}

// ── Operational Risk Score – LANDLORD ────────────────────────────────────────

export interface LandlordOpsData {
  buildingAgeYears: number;
  hasInsurance: boolean;
  maintenanceQuality: MaintenanceInput;
  locationRating: LocationRatingInput;
}

export function computeLandlordOpsScore(data: LandlordOpsData): number {
  let score = 0;

  // Building age (lower = less risk = higher score)
  if (data.buildingAgeYears <= 5)        score += 25;
  else if (data.buildingAgeYears <= 15)  score += 15;
  else if (data.buildingAgeYears <= 30)  score += 5;
  // > 30 → 0

  if (data.hasInsurance) score += 25;

  if (data.maintenanceQuality === 'GOOD')      score += 25;
  else if (data.maintenanceQuality === 'FAIR') score += 12;
  // POOR → 0

  const locMap: Record<LocationRatingInput, number> = {
    PRIME: 25, GOOD: 18, AVERAGE: 10, POOR: 0,
  };
  score += locMap[data.locationRating] ?? 0;

  return Math.min(100, score);
}

// ── Operational Risk Score – SHOP OWNER ──────────────────────────────────────

export interface ShopOwnerOpsData {
  locationRiskLevel: LocationRiskInput;
  competitorCount: number;
  supplierCount: number;
  hasInsurance: boolean;
}

export function computeShopOwnerOpsScore(data: ShopOwnerOpsData): number {
  let score = 0;

  // Location risk (inverted: LOW risk = high score)
  if (data.locationRiskLevel === 'LOW')         score += 30;
  else if (data.locationRiskLevel === 'MEDIUM') score += 15;
  // HIGH → 0

  // Competitor count (fewer = safer market position)
  if (data.competitorCount <= 2)                score += 20;
  else if (data.competitorCount <= 5)           score += 10;
  // > 5 → 0

  // Supplier diversification (more = lower supply risk)
  if (data.supplierCount >= 3)                  score += 25;
  else if (data.supplierCount >= 2)             score += 15;
  else                                          score += 5;

  if (data.hasInsurance)                        score += 25;

  return Math.min(100, score);
}

// ── Cash Flow Score (weight 25%) ──────────────────────────────────────────────
// DSR = (existingMonthlyDebt + newInstallment) / totalMonthlyIncome × 100
// Hard block at DSR > 50%

export interface CashFlowData {
  totalMonthlyIncome: number;
  existingMonthlyDebt: number;
  newInstallmentKes: number;
}

export interface CashFlowResult {
  score: number;
  dsr: number;      // percentage, e.g. 28.5
  hardBlock: boolean;
}

export function computeCashFlowScore(data: CashFlowData): CashFlowResult {
  const totalDebt = data.existingMonthlyDebt + data.newInstallmentKes;
  const dsr = data.totalMonthlyIncome > 0
    ? (totalDebt / data.totalMonthlyIncome) * 100
    : 100;

  const hardBlock = dsr > configService.num('ilp.cashflow.dsr.hard_block_pct');

  let score: number;
  if (dsr < 30)       score = configService.int('ilp.cashflow.dsr.score_under30');
  else if (dsr < 35)  score = configService.int('ilp.cashflow.dsr.score_30to35');
  else if (dsr < 40)  score = configService.int('ilp.cashflow.dsr.score_35to40');
  else if (dsr < 45)  score = configService.int('ilp.cashflow.dsr.score_40to45');
  else                score = configService.int('ilp.cashflow.dsr.score_45plus');

  return { score, dsr: parseFloat(dsr.toFixed(2)), hardBlock };
}

// ── Collateral Score (weight 10%) ─────────────────────────────────────────────

export interface CollateralItem {
  type: string;      // CollateralType enum value
  valueKes: number;
  isVerified: boolean;
}

export function computeCollateralScore(
  items: CollateralItem[],
  loanAmountKes: number,
): number {
  const totalValue = items.reduce((sum, i) => sum + i.valueKes, 0);
  const coverageRatio = loanAmountKes > 0 ? totalValue / loanAmountKes : 0;

  // Base from coverage ratio
  let score: number;
  if (coverageRatio > 2)          score = configService.int('ilp.collateral.score_over2');
  else if (coverageRatio >= 1.5)  score = configService.int('ilp.collateral.score_1p5to2');
  else if (coverageRatio >= 1)    score = configService.int('ilp.collateral.score_1to1p5');
  else                            score = configService.int('ilp.collateral.score_under1');

  // Quality bonus (additive, capped at 100)
  const qualityBonus = items.reduce((bonus, item) => {
    if (item.type === 'TITLE_DEED')    return bonus + configService.int('ilp.collateral.bonus_title');
    if (item.type === 'MOTOR_VEHICLE') return bonus + configService.int('ilp.collateral.bonus_vehicle');
    if (item.type === 'CHATTEL')       return bonus + configService.int('ilp.collateral.bonus_chattel');
    return bonus;
  }, 0);

  return Math.min(100, score + qualityBonus);
}

// ── Composite Score ───────────────────────────────────────────────────────────

export interface DimensionScores {
  ownerScore: number;
  businessScore: number;
  operationalRiskScore: number;
  cashFlowScore: number;
  collateralScore: number;
}

export function computeCompositeScore(scores: DimensionScores): number {
  return Math.round(
    scores.ownerScore           * configService.pct('ilp.weight.owner') +
    scores.businessScore        * configService.pct('ilp.weight.business') +
    scores.operationalRiskScore * configService.pct('ilp.weight.operational') +
    scores.cashFlowScore        * configService.pct('ilp.weight.cashflow') +
    scores.collateralScore      * configService.pct('ilp.weight.collateral'),
  );
}

export function deriveRecommendation(
  composite: number,
): 'APPROVE' | 'CONDITIONAL' | 'DECLINE' {
  if (composite >= configService.num('ilp.threshold.approve')) return 'APPROVE';
  if (composite >= configService.num('ilp.threshold.conditional')) return 'CONDITIONAL';
  return 'DECLINE';
}

// ── Segment-aware business score dispatcher ───────────────────────────────────

export function computeBusinessScore(
  segment: 'FARMER' | 'LANDLORD' | 'SHOP_OWNER',
  data: Record<string, unknown>,
): number {
  switch (segment) {
    case 'FARMER':
      return computeFarmerBusinessScore(data as unknown as FarmerBusinessData);
    case 'LANDLORD':
      return computeLandlordBusinessScore(data as unknown as LandlordBusinessData);
    case 'SHOP_OWNER':
      return computeShopOwnerBusinessScore(data as unknown as ShopOwnerBusinessData);
  }
}

export function computeOpsScore(
  segment: 'FARMER' | 'LANDLORD' | 'SHOP_OWNER',
  data: Record<string, unknown>,
): number {
  switch (segment) {
    case 'FARMER':
      return computeFarmerOpsScore(data as unknown as FarmerOpsData);
    case 'LANDLORD':
      return computeLandlordOpsScore(data as unknown as LandlordOpsData);
    case 'SHOP_OWNER':
      return computeShopOwnerOpsScore(data as unknown as ShopOwnerOpsData);
  }
}
