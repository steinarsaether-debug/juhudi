// ─── ILP Scoring Utility (frontend mirror of ilpScoringService.ts) ────────────
// Identical formulas to the backend service — used for live score preview in
// the wizard on every field change without making an API call.
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

export type CRBStatusInput = 'CLEAR' | 'PERFORMING' | 'UNKNOWN' | 'LISTED';
export type LoanHistoryInput = 'NONE' | 'ON_TIME' | 'SOME_LATE' | 'DEFAULT';
export type MarketAccessInput = 'SUBSISTENCE' | 'LOCAL_MARKET' | 'COOPERATIVE' | 'CONTRACT';
export type IrrigationInput = 'IRRIGATED' | 'MIXED' | 'RAIN_FED';
export type MaintenanceInput = 'GOOD' | 'FAIR' | 'POOR';
export type LocationRatingInput = 'PRIME' | 'GOOD' | 'AVERAGE' | 'POOR';
export type LocationRiskInput = 'LOW' | 'MEDIUM' | 'HIGH';

// ── Owner Score (weight 20%) ──────────────────────────────────────────────────

export interface OwnerData {
  experienceYears: number;
  crbStatus: CRBStatusInput;
  loanHistoryType: LoanHistoryInput;
  referenceCount: number;
}

export function computeOwnerScore(data: Partial<OwnerData>): number {
  let raw = 0;
  const exp = data.experienceYears ?? 0;
  if (exp >= 5)      raw += 50;
  else if (exp >= 2) raw += 30;
  else               raw += 10;

  if (data.crbStatus === 'CLEAR' || data.crbStatus === 'PERFORMING') raw += 30;
  else if (data.crbStatus === 'UNKNOWN') raw += 15;

  if (data.loanHistoryType === 'ON_TIME')     raw += 30;
  else if (data.loanHistoryType === 'NONE' || data.loanHistoryType === 'SOME_LATE') raw += 15;

  const refs = data.referenceCount ?? 0;
  if (refs >= 2)      raw += 20;
  else if (refs === 1) raw += 10;

  return Math.min(100, raw);
}

// ── Business Scores ───────────────────────────────────────────────────────────

export interface FarmerBusinessData {
  farmSizeAcres: number;
  marketAccess: MarketAccessInput;
  groupLoanCycles: number;
}

export function computeFarmerBusinessScore(data: Partial<FarmerBusinessData>): number {
  let raw = 0;
  const acres = data.farmSizeAcres ?? 0;
  if (acres >= 5)      raw += 50;
  else if (acres >= 3) raw += 40;
  else if (acres >= 1) raw += 25;
  else                 raw += 10;

  const mktMap: Record<MarketAccessInput, number> = {
    CONTRACT: 50, COOPERATIVE: 40, LOCAL_MARKET: 25, SUBSISTENCE: 10,
  };
  raw += mktMap[data.marketAccess ?? 'SUBSISTENCE'] ?? 10;

  const cycles = data.groupLoanCycles ?? 0;
  if (cycles >= 3)      raw += 50;
  else if (cycles >= 2) raw += 35;
  else if (cycles >= 1) raw += 20;
  else                  raw += 10;

  return Math.round(Math.min(100, (raw / 150) * 100));
}

export interface LandlordBusinessData {
  occupancyPct: number;
  unitCount: number;
  titleDeedVerified: boolean;
}

export function computeLandlordBusinessScore(data: Partial<LandlordBusinessData>): number {
  const cap = data.titleDeedVerified ? 100 : 40;
  let raw = 0;
  const occ = data.occupancyPct ?? 0;
  if (occ >= 85)      raw += 50;
  else if (occ >= 70) raw += 30;

  const units = data.unitCount ?? 0;
  if (units >= 6)      raw += 50;
  else if (units >= 3) raw += 35;
  else                 raw += 20;

  if (data.titleDeedVerified) raw += 50;

  const normalized = Math.round(Math.min(100, (raw / 150) * 100));
  return Math.min(cap, normalized);
}

export interface ShopOwnerBusinessData {
  yearsInBusiness: number;
  hasBusinessLicense: boolean;
  hasBookkeeping: boolean;
  stockVsLoanRatio: number;
}

export function computeShopOwnerBusinessScore(data: Partial<ShopOwnerBusinessData>): number {
  let raw = 0;
  const yrs = data.yearsInBusiness ?? 0;
  if (yrs >= 3)      raw += 50;
  else if (yrs >= 1) raw += 30;
  else               raw += 10;

  if (data.hasBusinessLicense) raw += 30;
  if (data.hasBookkeeping)     raw += 20;

  const ratio = data.stockVsLoanRatio ?? 0;
  if (ratio >= 2)      raw += 30;
  else if (ratio >= 1) raw += 20;

  return Math.round(Math.min(100, (raw / 130) * 100));
}

// ── Operational Risk Scores ───────────────────────────────────────────────────

export interface FarmerOpsData {
  irrigationType: IrrigationInput;
  hasStorage: boolean;
  hasCropInsurance: boolean;
  hasAlternativeIncome: boolean;
}

export function computeFarmerOpsScore(data: Partial<FarmerOpsData>): number {
  let score = 0;
  if (data.irrigationType === 'IRRIGATED')  score += 25;
  else if (data.irrigationType === 'MIXED') score += 15;
  if (data.hasStorage)           score += 25;
  if (data.hasCropInsurance)     score += 25;
  if (data.hasAlternativeIncome) score += 25;
  return Math.min(100, score);
}

export interface LandlordOpsData {
  buildingAgeYears: number;
  hasInsurance: boolean;
  maintenanceQuality: MaintenanceInput;
  locationRating: LocationRatingInput;
}

export function computeLandlordOpsScore(data: Partial<LandlordOpsData>): number {
  let score = 0;
  const age = data.buildingAgeYears ?? 99;
  if (age <= 5)       score += 25;
  else if (age <= 15) score += 15;
  else if (age <= 30) score += 5;

  if (data.hasInsurance) score += 25;

  if (data.maintenanceQuality === 'GOOD')      score += 25;
  else if (data.maintenanceQuality === 'FAIR') score += 12;

  const locMap: Record<LocationRatingInput, number> = {
    PRIME: 25, GOOD: 18, AVERAGE: 10, POOR: 0,
  };
  score += locMap[data.locationRating ?? 'POOR'] ?? 0;

  return Math.min(100, score);
}

export interface ShopOwnerOpsData {
  locationRiskLevel: LocationRiskInput;
  competitorCount: number;
  supplierCount: number;
  hasInsurance: boolean;
}

export function computeShopOwnerOpsScore(data: Partial<ShopOwnerOpsData>): number {
  let score = 0;
  if (data.locationRiskLevel === 'LOW')         score += 30;
  else if (data.locationRiskLevel === 'MEDIUM') score += 15;

  const comp = data.competitorCount ?? 99;
  if (comp <= 2)      score += 20;
  else if (comp <= 5) score += 10;

  const supp = data.supplierCount ?? 0;
  if (supp >= 3)      score += 25;
  else if (supp >= 2) score += 15;
  else                score += 5;

  if (data.hasInsurance) score += 25;
  return Math.min(100, score);
}

// ── Cash Flow Score ───────────────────────────────────────────────────────────

export interface CashFlowData {
  totalMonthlyIncome: number;
  existingMonthlyDebt: number;
  newInstallmentKes: number;
}

export interface CashFlowResult {
  score: number;
  dsr: number;
  hardBlock: boolean;
}

export function computeCashFlowScore(data: Partial<CashFlowData>): CashFlowResult {
  const income  = data.totalMonthlyIncome ?? 0;
  const debt    = (data.existingMonthlyDebt ?? 0) + (data.newInstallmentKes ?? 0);
  const dsr     = income > 0 ? (debt / income) * 100 : 100;
  const hardBlock = dsr > 50;

  let score: number;
  if (dsr < 30)      score = 100;
  else if (dsr < 35) score = 80;
  else if (dsr < 40) score = 60;
  else if (dsr < 45) score = 40;
  else               score = 0;

  return { score, dsr: parseFloat(dsr.toFixed(2)), hardBlock };
}

// ── Collateral Score ──────────────────────────────────────────────────────────

export interface CollateralItem {
  type: string;
  valueKes: number;
  isVerified: boolean;
}

export function computeCollateralScore(items: CollateralItem[], loanAmountKes: number): number {
  const totalValue = items.reduce((s, i) => s + i.valueKes, 0);
  const ratio = loanAmountKes > 0 ? totalValue / loanAmountKes : 0;

  let score: number;
  if (ratio > 2)         score = 100;
  else if (ratio >= 1.5) score = 75;
  else if (ratio >= 1)   score = 50;
  else                   score = 20;

  const bonus = items.reduce((b, item) => {
    if (item.type === 'TITLE_DEED')    return b + 20;
    if (item.type === 'MOTOR_VEHICLE') return b + 10;
    if (item.type === 'CHATTEL')       return b + 5;
    return b;
  }, 0);

  return Math.min(100, score + bonus);
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
    scores.ownerScore           * 0.20 +
    scores.businessScore        * 0.25 +
    scores.operationalRiskScore * 0.20 +
    scores.cashFlowScore        * 0.25 +
    scores.collateralScore      * 0.10,
  );
}

export function deriveRecommendation(composite: number): 'APPROVE' | 'CONDITIONAL' | 'DECLINE' {
  if (composite >= 75) return 'APPROVE';
  if (composite >= 60) return 'CONDITIONAL';
  return 'DECLINE';
}

// ── Dispatcher helpers (segment-aware) ────────────────────────────────────────

export function computeBusinessScore(
  segment: 'FARMER' | 'LANDLORD' | 'SHOP_OWNER',
  data: Record<string, unknown>,
): number {
  switch (segment) {
    case 'FARMER':     return computeFarmerBusinessScore(data as Partial<FarmerBusinessData>);
    case 'LANDLORD':   return computeLandlordBusinessScore(data as Partial<LandlordBusinessData>);
    case 'SHOP_OWNER': return computeShopOwnerBusinessScore(data as Partial<ShopOwnerBusinessData>);
  }
}

export function computeOpsScore(
  segment: 'FARMER' | 'LANDLORD' | 'SHOP_OWNER',
  data: Record<string, unknown>,
): number {
  switch (segment) {
    case 'FARMER':     return computeFarmerOpsScore(data as Partial<FarmerOpsData>);
    case 'LANDLORD':   return computeLandlordOpsScore(data as Partial<LandlordOpsData>);
    case 'SHOP_OWNER': return computeShopOwnerOpsScore(data as Partial<ShopOwnerOpsData>);
  }
}

// ── Monthly installment helper (reducing balance) ─────────────────────────────

export function calcMonthlyInstallment(
  principalKes: number,
  annualRatePct: number,
  termMonths: number,
): number {
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return Math.round(principalKes / termMonths);
  const installment =
    (principalKes * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  return Math.round(installment);
}
