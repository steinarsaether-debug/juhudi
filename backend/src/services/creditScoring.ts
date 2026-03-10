/**
 * Juhudi Kilimo Credit Scoring Engine
 *
 * Scoring philosophy (CBK Microfinance Guidelines):
 *  • Cash Flow  (35 pts) – Can the farm generate enough income?
 *  • Ability    (35 pts) – Are the farming fundamentals sound?
 *  • Willingness (30 pts) – Will the customer repay?
 *
 * Decision thresholds:
 *  70-100 → APPROVE
 *  50-69  → CONDITIONAL (supervisor review)
 *  30-49  → DECLINE
 *   0-29  → STRONG_DECLINE
 */

import { configService } from './configService';

export interface ScoringInput {
  // Cash Flow inputs
  monthlyFarmIncome: number;       // KES
  monthlyOffFarmIncome: number;    // KES
  monthlyHouseholdExpenses: number; // KES
  otherMonthlyDebt: number;        // KES (existing loan repayments)
  mpesaMonthlyAvgKes: number | null;
  hasGroupMembership: boolean;
  groupMonthlySavingsKes: number | null;

  // Ability inputs
  farmSizeAcres: number;
  landOwnership: 'OWNED' | 'LEASED' | 'COMMUNAL' | 'FAMILY';
  primaryCrop: string;
  secondaryCrops: string[];
  marketAccess: 'CONTRACT' | 'COOPERATIVE' | 'LOCAL_MARKET' | 'SUBSISTENCE';
  irrigationType: 'IRRIGATED' | 'RAIN_FED' | 'MIXED';
  livestockCount: number;

  // Willingness inputs
  yaraMemberSinceYears: number | null;  // null = new customer
  yaraProductsUsedCount: number;
  crbStatus: 'CLEAR' | 'LISTED' | 'UNKNOWN' | 'PERFORMING';
  previousLoansCount: number;
  previousLoansRepaidOnTime: boolean | null;
  numberOfDependents: number;

  // Loan request
  requestedAmountKes: number;
  termMonths: number;

  // Geographic context (for benchmark comparison)
  county?: string;
  region?: string;
}

export interface BenchmarkComparison {
  itemName: string;
  category: string;
  statedMonthlyKes: number;
  benchmarkLowKes: number;
  benchmarkMidKes: number;
  benchmarkHighKes: number;
  deviationPct: number;        // positive = stated > benchmark
  flagged: boolean;            // true if stated > benchmarkHigh * 1.5
  scope: string;               // NATIONAL / REGION / COUNTY
  sourceShortName: string;
  referenceYear: number;
}

export interface ScoreBreakdown {
  component: string;
  score: number;
  maxScore: number;
  notes: string[];
}

export interface ScoringResult {
  totalScore: number;
  cashflowScore: number;
  cashflowBreakdown: ScoreBreakdown[];
  abilityScore: number;
  abilityBreakdown: ScoreBreakdown[];
  willingnessScore: number;
  willingnessBreakdown: ScoreBreakdown[];
  recommendation: 'APPROVE' | 'CONDITIONAL' | 'DECLINE' | 'STRONG_DECLINE';
  maxLoanAmountKes: number;
  suggestedTermMonths: number;
  scoringNotes: string[];
  requiresSupervisorReview: boolean;
  benchmarkComparisons: BenchmarkComparison[];
  benchmarkPenaltyApplied: number;  // pts deducted from cashflow score
}

// ─── CASHFLOW SCORING (max 35 points) ────────────────────────────────────────

function scoreCashflow(input: ScoringInput): { score: number; breakdown: ScoreBreakdown[] } {
  const cfg = configService;
  const breakdown: ScoreBreakdown[] = [];
  let total = 0;

  const totalIncome = input.monthlyFarmIncome + input.monthlyOffFarmIncome;
  const monthlyInstallment = estimateInstallment(input.requestedAmountKes, input.termMonths);
  const totalDebt = input.otherMonthlyDebt + monthlyInstallment;
  const dti = totalIncome > 0 ? totalDebt / totalIncome : 1;

  // 1. Debt-to-Income Ratio (max 15 pts)
  const dtiThresholdExcellent  = cfg.pct('scoring.group.cashflow.dti.threshold_excellent');
  const dtiThresholdGood       = cfg.pct('scoring.group.cashflow.dti.threshold_good');
  const dtiThresholdAcceptable = cfg.pct('scoring.group.cashflow.dti.threshold_acceptable');
  const dtiThresholdHigh       = cfg.pct('scoring.group.cashflow.dti.threshold_high');
  const dtiScoreExcellent      = cfg.num('scoring.group.cashflow.dti.score_excellent');
  const dtiScoreGood           = cfg.num('scoring.group.cashflow.dti.score_good');
  const dtiScoreAcceptable     = cfg.num('scoring.group.cashflow.dti.score_acceptable');
  const dtiScoreHigh           = cfg.num('scoring.group.cashflow.dti.score_high');
  const dtiScoreMax            = cfg.num('scoring.group.cashflow.dti.score_max');

  let dtiScore = 0;
  const dtiNotes: string[] = [];
  if (dti < dtiThresholdExcellent) {
    dtiScore = dtiScoreExcellent;
    dtiNotes.push(`Excellent DTI < ${(dtiThresholdExcellent * 100).toFixed(0)}%`);
  } else if (dti < dtiThresholdGood) {
    dtiScore = dtiScoreGood;
    dtiNotes.push(`Good DTI ${(dtiThresholdExcellent * 100).toFixed(0)}-${(dtiThresholdGood * 100).toFixed(0)}%`);
  } else if (dti < dtiThresholdAcceptable) {
    dtiScore = dtiScoreAcceptable;
    dtiNotes.push(`Acceptable DTI ${(dtiThresholdGood * 100).toFixed(0)}-${(dtiThresholdAcceptable * 100).toFixed(0)}%`);
  } else if (dti < dtiThresholdHigh) {
    dtiScore = dtiScoreHigh;
    dtiNotes.push(`High DTI ${(dtiThresholdAcceptable * 100).toFixed(0)}-${(dtiThresholdHigh * 100).toFixed(0)}%`);
  } else {
    dtiScore = 0;
    dtiNotes.push(`Very high DTI ${(dti * 100).toFixed(0)}% – repayment risk`);
  }
  breakdown.push({ component: 'Debt-to-Income Ratio', score: dtiScore, maxScore: dtiScoreMax, notes: dtiNotes });
  total += dtiScore;

  // 2. Mobile Money Activity (max 10 pts)
  const mpesaThresholdStrong   = cfg.num('scoring.group.cashflow.mpesa.threshold_strong');
  const mpesaThresholdGood     = cfg.num('scoring.group.cashflow.mpesa.threshold_good');
  const mpesaThresholdModerate = cfg.num('scoring.group.cashflow.mpesa.threshold_moderate');
  const mpesaScoreStrong       = cfg.num('scoring.group.cashflow.mpesa.score_strong');
  const mpesaScoreGood         = cfg.num('scoring.group.cashflow.mpesa.score_good');
  const mpesaScoreModerate     = cfg.num('scoring.group.cashflow.mpesa.score_moderate');
  const mpesaScoreLow          = cfg.num('scoring.group.cashflow.mpesa.score_low');
  const mpesaScoreMax          = cfg.num('scoring.group.cashflow.mpesa.score_max');

  let mpesaScore = 0;
  const mpesaNotes: string[] = [];
  const mpesa = input.mpesaMonthlyAvgKes ?? 0;
  if (mpesa >= mpesaThresholdStrong) {
    mpesaScore = mpesaScoreStrong;
    mpesaNotes.push(`Strong M-Pesa activity > KES ${mpesaThresholdStrong.toLocaleString()}/mo`);
  } else if (mpesa >= mpesaThresholdGood) {
    mpesaScore = mpesaScoreGood;
    mpesaNotes.push(`Good M-Pesa activity KES ${(mpesaThresholdGood / 1000).toFixed(0)}k-${(mpesaThresholdStrong / 1000).toFixed(0)}k/mo`);
  } else if (mpesa >= mpesaThresholdModerate) {
    mpesaScore = mpesaScoreModerate;
    mpesaNotes.push(`Moderate M-Pesa activity KES ${(mpesaThresholdModerate / 1000).toFixed(0)}k-${(mpesaThresholdGood / 1000).toFixed(0)}k/mo`);
  } else if (mpesa >= 1_000) {
    mpesaScore = mpesaScoreLow;
    mpesaNotes.push(`Low M-Pesa activity < KES ${(mpesaThresholdModerate / 1000).toFixed(0)}k/mo`);
  } else {
    mpesaScore = 0;
    mpesaNotes.push('No M-Pesa data provided');
  }
  breakdown.push({ component: 'Mobile Money Activity', score: mpesaScore, maxScore: mpesaScoreMax, notes: mpesaNotes });
  total += mpesaScore;

  // 3. Group/Chama Savings (max 10 pts)
  const groupThresholdActive  = cfg.num('scoring.group.cashflow.group.threshold_active');
  const groupThresholdRegular = cfg.num('scoring.group.cashflow.group.threshold_regular');
  const groupScoreActive      = cfg.num('scoring.group.cashflow.group.score_active');
  const groupScoreRegular     = cfg.num('scoring.group.cashflow.group.score_regular');
  const groupScoreMinimal     = cfg.num('scoring.group.cashflow.group.score_minimal');
  const groupScoreMax         = cfg.num('scoring.group.cashflow.group.score_max');

  let groupScore = 0;
  const groupNotes: string[] = [];
  if (input.hasGroupMembership) {
    const savings = input.groupMonthlySavingsKes ?? 0;
    if (savings >= groupThresholdActive) {
      groupScore = groupScoreActive;
      groupNotes.push(`Active savings group member, KES ≥${(groupThresholdActive / 1000).toFixed(0)}k/mo savings`);
    } else if (savings >= groupThresholdRegular) {
      groupScore = groupScoreRegular;
      groupNotes.push(`Savings group member, KES ${(groupThresholdRegular / 1000).toFixed(0)}k-${(groupThresholdActive / 1000).toFixed(0)}k/mo`);
    } else {
      groupScore = groupScoreMinimal;
      groupNotes.push('Group member, minimal savings');
    }
  } else {
    groupScore = 0;
    groupNotes.push('Not a member of any savings group or chama');
  }
  breakdown.push({ component: 'Group/Chama Membership', score: groupScore, maxScore: groupScoreMax, notes: groupNotes });
  total += groupScore;

  const cashflowMax = cfg.num('scoring.group.cashflow.dti.score_max')
    + cfg.num('scoring.group.cashflow.mpesa.score_max')
    + cfg.num('scoring.group.cashflow.group.score_max');

  return { score: Math.min(total, cashflowMax), breakdown };
}

// ─── ABILITY SCORING (max 35 points) ─────────────────────────────────────────

function scoreAbility(input: ScoringInput): { score: number; breakdown: ScoreBreakdown[] } {
  const cfg = configService;
  const breakdown: ScoreBreakdown[] = [];
  let total = 0;

  // 1. Farm Size & Land Security (max 10 pts)
  const farmThresholdLarge  = cfg.num('scoring.group.ability.farm.threshold_large');
  const farmThresholdMedium = cfg.num('scoring.group.ability.farm.threshold_medium');
  const farmThresholdSmall  = cfg.num('scoring.group.ability.farm.threshold_small');
  const farmScoreLarge      = cfg.num('scoring.group.ability.farm.score_large');
  const farmScoreMedium     = cfg.num('scoring.group.ability.farm.score_medium');
  const farmScoreSmall      = cfg.num('scoring.group.ability.farm.score_small');
  const farmScoreTiny       = cfg.num('scoring.group.ability.farm.score_tiny');
  const farmScoreMax        = cfg.num('scoring.group.ability.farm.score_max');

  let farmScore = 0;
  const farmNotes: string[] = [];
  if (input.farmSizeAcres > farmThresholdLarge) {
    farmScore = farmScoreLarge;
    farmNotes.push(`Large farm ${input.farmSizeAcres.toFixed(1)} acres`);
  } else if (input.farmSizeAcres >= farmThresholdMedium) {
    farmScore = farmScoreMedium;
    farmNotes.push(`Medium farm ${input.farmSizeAcres.toFixed(1)} acres`);
  } else if (input.farmSizeAcres >= farmThresholdSmall) {
    farmScore = farmScoreSmall;
    farmNotes.push(`Small farm ${input.farmSizeAcres.toFixed(1)} acres`);
  } else {
    farmScore = farmScoreTiny;
    farmNotes.push(`Very small farm ${input.farmSizeAcres.toFixed(1)} acres`);
  }
  if (input.landOwnership === 'OWNED') {
    farmScore = Math.min(farmScore + 1, farmScoreMax);
    farmNotes.push('Owns land (+bonus)');
  }
  breakdown.push({ component: 'Farm Size & Land', score: farmScore, maxScore: farmScoreMax, notes: farmNotes });
  total += farmScore;

  // 2. Market Access (max 10 pts)
  const marketScoreContract    = cfg.num('scoring.group.ability.market.score_contract');
  const marketScoreCooperative = cfg.num('scoring.group.ability.market.score_cooperative');
  const marketScoreLocal       = cfg.num('scoring.group.ability.market.score_local');
  const marketScoreSubsistence = cfg.num('scoring.group.ability.market.score_subsistence');
  const marketBonusIrrigated   = cfg.num('scoring.group.ability.market.bonus_irrigated');
  const marketScoreMax         = cfg.num('scoring.group.ability.market.score_max');

  let marketScore = 0;
  const marketNotes: string[] = [];
  switch (input.marketAccess) {
    case 'CONTRACT':
      marketScore = marketScoreContract;
      marketNotes.push('Formal contract farming – predictable revenue');
      break;
    case 'COOPERATIVE':
      marketScore = marketScoreCooperative;
      marketNotes.push('Cooperative member – good market linkage');
      break;
    case 'LOCAL_MARKET':
      marketScore = marketScoreLocal;
      marketNotes.push('Local market access');
      break;
    case 'SUBSISTENCE':
      marketScore = marketScoreSubsistence;
      marketNotes.push('Primarily subsistence – limited cash income');
      break;
  }
  if (input.irrigationType === 'IRRIGATED') {
    marketScore = Math.min(marketScore + marketBonusIrrigated, marketScoreMax);
    marketNotes.push('Irrigated – year-round production possible');
  }
  breakdown.push({ component: 'Market Access', score: marketScore, maxScore: marketScoreMax, notes: marketNotes });
  total += marketScore;

  // 3. Income Diversification (max 8 pts)
  const diversScoreHigh     = cfg.num('scoring.group.ability.divers.score_high');
  const diversScoreGood     = cfg.num('scoring.group.ability.divers.score_good');
  const diversScoreMultiple = cfg.num('scoring.group.ability.divers.score_multiple');
  const diversScoreSome     = cfg.num('scoring.group.ability.divers.score_some');
  const diversScoreNone     = cfg.num('scoring.group.ability.divers.score_none');
  const diversScoreMax      = cfg.num('scoring.group.ability.divers.score_max');

  let diversScore = 0;
  const diversNotes: string[] = [];
  const hasOffFarm = input.monthlyOffFarmIncome > 0;
  const cropCount = 1 + input.secondaryCrops.length;
  const hasLivestock = input.livestockCount > 0;
  if (cropCount >= 3 && hasOffFarm) {
    diversScore = diversScoreHigh;
    diversNotes.push('Multiple crops + off-farm income');
  } else if (cropCount >= 2 && (hasOffFarm || hasLivestock)) {
    diversScore = diversScoreGood;
    diversNotes.push('Good diversification');
  } else if (cropCount >= 2) {
    diversScore = diversScoreMultiple;
    diversNotes.push('Multiple crops');
  } else if (hasOffFarm || hasLivestock) {
    diversScore = diversScoreSome;
    diversNotes.push('Some income diversification');
  } else {
    diversScore = diversScoreNone;
    diversNotes.push('Single crop, no off-farm income');
  }
  breakdown.push({ component: 'Income Diversification', score: diversScore, maxScore: diversScoreMax, notes: diversNotes });
  total += diversScore;

  // 4. Loan-to-Annual-Income Ratio (max 7 pts)
  const ltirThresholdVery        = cfg.pct('scoring.group.ability.ltir.threshold_very');
  const ltirThresholdManageable  = cfg.pct('scoring.group.ability.ltir.threshold_manageable');
  const ltirThresholdStretching  = cfg.pct('scoring.group.ability.ltir.threshold_stretching');
  const ltirScoreVeryManageable  = cfg.num('scoring.group.ability.ltir.score_very_manageable');
  const ltirScoreManageable      = cfg.num('scoring.group.ability.ltir.score_manageable');
  const ltirScoreStretching      = cfg.num('scoring.group.ability.ltir.score_stretching');
  const ltirScoreMax             = cfg.num('scoring.group.ability.ltir.score_max');

  let ltirScore = 0;
  const ltirNotes: string[] = [];
  const annualIncome = (input.monthlyFarmIncome + input.monthlyOffFarmIncome) * 12;
  const ltir = annualIncome > 0 ? input.requestedAmountKes / annualIncome : 1;
  if (ltir <= ltirThresholdVery) {
    ltirScore = ltirScoreVeryManageable;
    ltirNotes.push(`Loan is ${(ltir * 100).toFixed(0)}% of annual income – very manageable`);
  } else if (ltir <= ltirThresholdManageable) {
    ltirScore = ltirScoreManageable;
    ltirNotes.push(`Loan is ${(ltir * 100).toFixed(0)}% of annual income – manageable`);
  } else if (ltir <= ltirThresholdStretching) {
    ltirScore = ltirScoreStretching;
    ltirNotes.push(`Loan is ${(ltir * 100).toFixed(0)}% of annual income – stretching`);
  } else {
    ltirScore = 0;
    ltirNotes.push(`Loan exceeds ${(ltirThresholdStretching * 100).toFixed(0)}% of annual income – high risk`);
  }
  breakdown.push({ component: 'Loan-to-Income Ratio', score: ltirScore, maxScore: ltirScoreMax, notes: ltirNotes });
  total += ltirScore;

  return { score: Math.min(total, 35), breakdown };
}

// ─── WILLINGNESS SCORING (max 30 points) ─────────────────────────────────────

function scoreWillingness(input: ScoringInput): { score: number; breakdown: ScoreBreakdown[] } {
  const cfg = configService;
  const breakdown: ScoreBreakdown[] = [];
  let total = 0;

  // 1. Yara Customer Relationship (max 10 pts)
  const yaraThreshold4plus    = cfg.num('scoring.group.will.yara.threshold_4plus');
  const yaraThreshold2to4     = cfg.num('scoring.group.will.yara.threshold_2to4');
  const yaraThreshold1to2     = cfg.num('scoring.group.will.yara.threshold_1to2');
  const yaraProductsThreshold = cfg.num('scoring.group.will.yara.products_threshold');
  const yaraScore4plus        = cfg.num('scoring.group.will.yara.score_4plus');
  const yaraScore2to4         = cfg.num('scoring.group.will.yara.score_2to4');
  const yaraScore1to2         = cfg.num('scoring.group.will.yara.score_1to2');
  const yaraScoreUnder1       = cfg.num('scoring.group.will.yara.score_under1');
  const yaraScoreNone         = cfg.num('scoring.group.will.yara.score_none');
  const yaraBonusProducts     = cfg.num('scoring.group.will.yara.bonus_products');
  const yaraScoreMax          = cfg.num('scoring.group.will.yara.score_max');

  let yaraScore = 0;
  const yaraNotes: string[] = [];
  const years = input.yaraMemberSinceYears ?? 0;
  if (years >= yaraThreshold4plus) {
    yaraScore = yaraScore4plus;
    yaraNotes.push(`${years}+ years Yara customer – strong relationship`);
  } else if (years >= yaraThreshold2to4) {
    yaraScore = yaraScore2to4;
    yaraNotes.push(`${years} years Yara customer`);
  } else if (years >= yaraThreshold1to2) {
    yaraScore = yaraScore1to2;
    yaraNotes.push(`${years} year Yara customer`);
  } else if (years > 0) {
    yaraScore = yaraScoreUnder1;
    yaraNotes.push('New Yara customer (< 1 year)');
  } else {
    yaraScore = yaraScoreNone;
    yaraNotes.push('Not previously a Yara customer');
  }
  if (input.yaraProductsUsedCount >= yaraProductsThreshold) {
    yaraScore = Math.min(yaraScore + yaraBonusProducts, yaraScoreMax);
    yaraNotes.push(`Uses ≥${yaraProductsThreshold} Yara products`);
  }
  breakdown.push({ component: 'Yara Customer Relationship', score: yaraScore, maxScore: yaraScoreMax, notes: yaraNotes });
  total += yaraScore;

  // 2. Credit History / CRB (max 12 pts)
  const crbScoreClearOntime    = cfg.num('scoring.group.will.crb.score_clear_ontime');
  const crbScoreClearNohistory = cfg.num('scoring.group.will.crb.score_clear_nohistory');
  const crbScoreClearIrregular = cfg.num('scoring.group.will.crb.score_clear_irregular');
  const crbScorePerforming     = cfg.num('scoring.group.will.crb.score_performing');
  const crbScoreUnknown        = cfg.num('scoring.group.will.crb.score_unknown');
  const crbScoreListed         = cfg.num('scoring.group.will.crb.score_listed');
  const crbScoreMax            = cfg.num('scoring.group.will.crb.score_max');

  let crbScore = 0;
  const crbNotes: string[] = [];
  if (input.crbStatus === 'CLEAR') {
    if (input.previousLoansCount > 0 && input.previousLoansRepaidOnTime === true) {
      crbScore = crbScoreClearOntime;
      crbNotes.push('Clean CRB, previous loans repaid on time');
    } else if (input.previousLoansCount === 0) {
      crbScore = crbScoreClearNohistory;
      crbNotes.push('Clean CRB, no prior loan history');
    } else {
      crbScore = crbScoreClearIrregular;
      crbNotes.push('Clean CRB, some repayment irregularities');
    }
  } else if (input.crbStatus === 'PERFORMING') {
    crbScore = crbScorePerforming;
    crbNotes.push('Active loans, performing well');
  } else if (input.crbStatus === 'UNKNOWN') {
    crbScore = crbScoreUnknown;
    crbNotes.push('CRB status not yet verified – neutral score applied');
  } else if (input.crbStatus === 'LISTED') {
    crbScore = crbScoreListed;
    crbNotes.push('⚠ CRB LISTED – customer has negative credit listing');
  }
  breakdown.push({ component: 'Credit History (CRB)', score: crbScore, maxScore: crbScoreMax, notes: crbNotes });
  total += crbScore;

  // 3. Community / Social Capital (max 8 pts)
  const socialSavingsThreshold  = cfg.num('scoring.group.will.social.savings_threshold');
  const socialScoreActive       = cfg.num('scoring.group.will.social.score_active');
  const socialScoreMember       = cfg.num('scoring.group.will.social.score_member');
  const socialScoreNone         = cfg.num('scoring.group.will.social.score_none');
  const socialDependentPenalty  = cfg.num('scoring.group.will.social.dependent_penalty');
  const socialDependentThreshold = cfg.num('scoring.group.will.social.dependent_threshold');
  const socialScoreMax          = cfg.num('scoring.group.will.social.score_max');

  let socialScore = 0;
  const socialNotes: string[] = [];
  if (input.hasGroupMembership && input.groupMonthlySavingsKes && input.groupMonthlySavingsKes >= socialSavingsThreshold) {
    socialScore = socialScoreActive;
    socialNotes.push('Active group/chama member with regular savings');
  } else if (input.hasGroupMembership) {
    socialScore = socialScoreMember;
    socialNotes.push('Group/chama member');
  } else {
    socialScore = socialScoreNone;
    socialNotes.push('No group membership');
  }
  // Dependents as negative modifier
  if (input.numberOfDependents > socialDependentThreshold) {
    socialScore = Math.max(socialScore - socialDependentPenalty, 0);
    socialNotes.push(`High number of dependents (${input.numberOfDependents}) – increased household burden`);
  }
  breakdown.push({ component: 'Social Capital', score: socialScore, maxScore: socialScoreMax, notes: socialNotes });
  total += socialScore;

  return { score: Math.min(total, 30), breakdown };
}

// ─── MAX LOAN AMOUNT CALCULATION ──────────────────────────────────────────────

function calculateMaxLoan(input: ScoringInput, totalScore: number): { maxKes: number; termMonths: number } {
  const cfg = configService;

  const cbkMaxRepaymentRatio = cfg.pct('scoring.group.cbk_max_repayment_ratio');
  const monthlyRate          = cfg.pct('scoring.group.monthly_rate_pct');
  const maxLoanCeiling       = cfg.num('scoring.group.max_loan_ceiling_kes');
  const multiplierApprove    = cfg.pct('scoring.group.multiplier.approve');
  const multiplierConditional = cfg.pct('scoring.group.multiplier.conditional');
  const multiplierDecline    = cfg.pct('scoring.group.multiplier.decline');
  const termIrrigated        = cfg.num('scoring.group.term.irrigated_months');
  const termRainFed          = cfg.num('scoring.group.term.rain_fed_months');
  const approveThreshold     = cfg.num('scoring.group.approve_threshold');
  const conditionalThreshold = cfg.num('scoring.group.conditional_threshold');

  const totalIncome = input.monthlyFarmIncome + input.monthlyOffFarmIncome;
  const netDisposable = totalIncome - input.monthlyHouseholdExpenses - input.otherMonthlyDebt;

  // CBK guideline: repayment should not exceed configured ratio of net income
  const maxMonthlyRepayment = netDisposable * cbkMaxRepaymentRatio;

  // Simple annuity formula (flat interest approximation for microfinance)
  const maxByIncome = maxMonthlyRepayment * input.termMonths / (1 + monthlyRate * input.termMonths);

  // Annual farm income ceiling (seasonal consideration)
  const annualFarm = input.monthlyFarmIncome * 12;
  const maxByFarm = annualFarm * 0.40;  // max 40% of annual farm income

  let maxKes = Math.min(maxByIncome, maxByFarm);

  // Apply score multiplier
  if (totalScore >= approveThreshold) {
    maxKes = maxKes * multiplierApprove;
  } else if (totalScore >= conditionalThreshold) {
    maxKes = maxKes * multiplierConditional;
  } else {
    maxKes = maxKes * multiplierDecline;
  }

  // Product floor/ceiling
  maxKes = Math.max(0, Math.min(maxKes, maxLoanCeiling));
  maxKes = Math.round(maxKes / 1_000) * 1_000; // round to nearest 1,000

  // Suggest term based on crop cycle
  const suggestedTerm = input.irrigationType === 'IRRIGATED' ? termIrrigated : termRainFed;

  return { maxKes, termMonths: suggestedTerm };
}

function estimateInstallment(amountKes: number, termMonths: number): number {
  const monthlyRate = configService.pct('scoring.group.monthly_rate_pct');
  return (amountKes * (1 + monthlyRate * termMonths)) / termMonths;
}

// ─── MAIN SCORING FUNCTION ────────────────────────────────────────────────────

export function scoreCustomer(input: ScoringInput): ScoringResult {
  const cfg = configService;

  const approveThreshold        = cfg.num('scoring.group.approve_threshold');
  const conditionalThreshold    = cfg.num('scoring.group.conditional_threshold');
  const declineThreshold        = cfg.num('scoring.group.decline_threshold');
  const supervisorReviewThreshold = cfg.num('scoring.group.supervisor_review_kes');

  const cashflowResult = scoreCashflow(input);
  const abilityResult = scoreAbility(input);
  const willingnessResult = scoreWillingness(input);

  const totalScore = cashflowResult.score + abilityResult.score + willingnessResult.score;

  let recommendation: ScoringResult['recommendation'];
  if (totalScore >= approveThreshold) recommendation = 'APPROVE';
  else if (totalScore >= conditionalThreshold) recommendation = 'CONDITIONAL';
  else if (totalScore >= declineThreshold) recommendation = 'DECLINE';
  else recommendation = 'STRONG_DECLINE';

  // Auto-approve needs supervisor if above threshold or CRB unknown
  const { maxKes, termMonths } = calculateMaxLoan(input, totalScore);
  const requiresSupervisorReview =
    recommendation === 'CONDITIONAL' ||
    (recommendation === 'APPROVE' && input.requestedAmountKes > supervisorReviewThreshold) ||
    input.crbStatus === 'UNKNOWN';

  const scoringNotes: string[] = [];
  if (input.crbStatus === 'LISTED') {
    scoringNotes.push('⚠ COMPLIANCE: Customer has active negative CRB listing. Loan requires EDD review.');
  }
  if (input.crbStatus === 'UNKNOWN') {
    scoringNotes.push('CRB verification pending. Score assumes no negative history. Confirm before disbursement.');
  }
  if (recommendation === 'APPROVE' && input.requestedAmountKes > maxKes) {
    scoringNotes.push(`Requested amount KES ${input.requestedAmountKes.toLocaleString()} exceeds computed maximum KES ${maxKes.toLocaleString()}. Consider offering reduced amount.`);
  }
  if (input.monthlyFarmIncome === 0) {
    scoringNotes.push('No farm income reported – income data should be verified with field visit.');
  }

  return {
    totalScore,
    cashflowScore: cashflowResult.score,
    cashflowBreakdown: cashflowResult.breakdown,
    abilityScore: abilityResult.score,
    abilityBreakdown: abilityResult.breakdown,
    willingnessScore: willingnessResult.score,
    willingnessBreakdown: willingnessResult.breakdown,
    recommendation,
    maxLoanAmountKes: maxKes,
    suggestedTermMonths: termMonths,
    scoringNotes,
    requiresSupervisorReview,
    // Populated by the controller after DB lookup
    benchmarkComparisons: [],
    benchmarkPenaltyApplied: 0,
  };
}
