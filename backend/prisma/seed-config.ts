/**
 * Seed system_configs table with all tunable business constants.
 * Run: npx tsx prisma/seed-config.ts
 *
 * Safe to re-run — uses upsert so existing DB overrides are preserved.
 * Only inserts/updates keys defined here; never deletes existing rows.
 */
import { PrismaClient, ConfigDataType } from '@prisma/client';
import { CONFIG_DEFAULTS } from '../src/services/configDefaults';

const prisma = new PrismaClient();

interface ConfigMeta {
  dataType:    ConfigDataType;
  category:    string;
  label:       string;
  description?: string;
  unit?:       string;
  minValue?:   number;
  maxValue?:   number;
  isEditable?: boolean;
}

// ── Full metadata for every config key ────────────────────────────────────────
const META: Record<string, ConfigMeta> = {

  // ── Award / Loyalty Tiers ──────────────────────────────────────────────────
  'award.bronze.min_cycles':       { dataType: 'NUMBER',    category: 'Award Tiers',  label: 'Bronze – Min Completed Cycles',  unit: 'cycles',  minValue: 1, maxValue: 10 },
  'award.bronze.max_arrears_days': { dataType: 'DAYS',      category: 'Award Tiers',  label: 'Bronze – Max Arrears Allowed',   unit: 'days',    minValue: 0, maxValue: 90 },
  'award.bronze.rate_discount':    { dataType: 'NUMBER',    category: 'Award Tiers',  label: 'Bronze – Interest Rate Discount',unit: '% p.a.',  minValue: 0, maxValue: 5, description: 'Percentage points off the nominal rate' },
  'award.bronze.fee_discount':     { dataType: 'PERCENTAGE',category: 'Award Tiers',  label: 'Bronze – Processing Fee Discount',unit: '%',      minValue: 0, maxValue: 100 },

  'award.silver.min_cycles':       { dataType: 'NUMBER',    category: 'Award Tiers',  label: 'Silver – Min Completed Cycles',  unit: 'cycles',  minValue: 1, maxValue: 15 },
  'award.silver.max_arrears_days': { dataType: 'DAYS',      category: 'Award Tiers',  label: 'Silver – Max Arrears Allowed',   unit: 'days',    minValue: 0, maxValue: 60 },
  'award.silver.rate_discount':    { dataType: 'NUMBER',    category: 'Award Tiers',  label: 'Silver – Interest Rate Discount',unit: '% p.a.',  minValue: 0, maxValue: 5 },
  'award.silver.fee_discount':     { dataType: 'PERCENTAGE',category: 'Award Tiers',  label: 'Silver – Processing Fee Discount',unit: '%',      minValue: 0, maxValue: 100 },

  'award.gold.min_cycles':         { dataType: 'NUMBER',    category: 'Award Tiers',  label: 'Gold – Min Completed Cycles',    unit: 'cycles',  minValue: 1, maxValue: 20 },
  'award.gold.max_arrears_days':   { dataType: 'DAYS',      category: 'Award Tiers',  label: 'Gold – Max Arrears Allowed',     unit: 'days',    minValue: 0, maxValue: 30 },
  'award.gold.rate_discount':      { dataType: 'NUMBER',    category: 'Award Tiers',  label: 'Gold – Interest Rate Discount',  unit: '% p.a.',  minValue: 0, maxValue: 5 },
  'award.gold.fee_discount':       { dataType: 'PERCENTAGE',category: 'Award Tiers',  label: 'Gold – Processing Fee Discount', unit: '%',       minValue: 0, maxValue: 100 },

  'award.platinum.min_cycles':       { dataType: 'NUMBER',  category: 'Award Tiers',  label: 'Platinum – Min Completed Cycles',unit: 'cycles',  minValue: 1, maxValue: 25 },
  'award.platinum.max_arrears_days': { dataType: 'DAYS',    category: 'Award Tiers',  label: 'Platinum – Max Arrears Allowed', unit: 'days',    minValue: 0, maxValue: 0, description: 'Must be 0 for Platinum – perfect repayment required' },
  'award.platinum.rate_discount':    { dataType: 'NUMBER',  category: 'Award Tiers',  label: 'Platinum – Interest Rate Discount',unit: '% p.a.',minValue: 0, maxValue: 5 },
  'award.platinum.fee_discount':     { dataType: 'PERCENTAGE',category:'Award Tiers', label: 'Platinum – Processing Fee Discount',unit: '%',    minValue: 0, maxValue: 100 },

  // ── Credit Scoring – Decisions ─────────────────────────────────────────────
  'scoring.group.approve_threshold':      { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Decisions', label: 'APPROVE Score Threshold',     unit: 'pts', minValue: 1,   maxValue: 100, description: 'Score at or above this → APPROVE recommendation' },
  'scoring.group.conditional_threshold':  { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Decisions', label: 'CONDITIONAL Score Threshold', unit: 'pts', minValue: 1,   maxValue: 100 },
  'scoring.group.decline_threshold':      { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Decisions', label: 'DECLINE Score Threshold',     unit: 'pts', minValue: 1,   maxValue: 100 },
  'scoring.group.supervisor_review_kes':  { dataType: 'AMOUNT_KES',   category: 'Credit Scoring – Decisions', label: 'Supervisor Review Amount',    unit: 'KES', minValue: 50000, maxValue: 500000, description: 'Loan amounts above this require supervisor sign-off' },
  'scoring.group.max_loan_ceiling_kes':   { dataType: 'AMOUNT_KES',   category: 'Credit Scoring – Decisions', label: 'Maximum Loan Ceiling',        unit: 'KES', minValue: 100000, maxValue: 2000000 },
  'scoring.group.cbk_max_repayment_ratio':{ dataType: 'PERCENTAGE',   category: 'Credit Scoring – Decisions', label: 'CBK Max Repayment Ratio',     unit: '%',   minValue: 20, maxValue: 60, description: 'Max monthly repayment as % of net disposable income (CBK guideline)' },
  'scoring.group.monthly_rate_pct':       { dataType: 'NUMBER',       category: 'Credit Scoring – Decisions', label: 'Monthly Interest Rate',       unit: '% /mo', minValue: 0.5, maxValue: 5, description: 'Used in installment calculations. 1.5% ≈ 18% p.a.' },

  // Loan amount multipliers
  'scoring.group.multiplier.approve':      { dataType: 'PERCENTAGE', category: 'Credit Scoring – Decisions', label: 'APPROVE Loan Multiplier',      unit: '%', minValue: 50, maxValue: 100 },
  'scoring.group.multiplier.conditional':  { dataType: 'PERCENTAGE', category: 'Credit Scoring – Decisions', label: 'CONDITIONAL Loan Multiplier',  unit: '%', minValue: 30, maxValue: 100 },
  'scoring.group.multiplier.decline':      { dataType: 'PERCENTAGE', category: 'Credit Scoring – Decisions', label: 'DECLINE Loan Multiplier',      unit: '%', minValue: 0,  maxValue: 80 },

  'scoring.group.term.irrigated_months':   { dataType: 'MONTHS', category: 'Credit Scoring – Decisions', label: 'Recommended Term – Irrigated', unit: 'months', minValue: 3, maxValue: 24 },
  'scoring.group.term.rain_fed_months':    { dataType: 'MONTHS', category: 'Credit Scoring – Decisions', label: 'Recommended Term – Rain-Fed',  unit: 'months', minValue: 3, maxValue: 12 },

  // Cashflow – DTI
  'scoring.group.cashflow.dti.score_excellent':   { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'DTI Score – Excellent (<threshold)', unit: 'pts', minValue: 0, maxValue: 20 },
  'scoring.group.cashflow.dti.score_good':         { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'DTI Score – Good', unit: 'pts', minValue: 0, maxValue: 20 },
  'scoring.group.cashflow.dti.score_acceptable':   { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'DTI Score – Acceptable', unit: 'pts', minValue: 0, maxValue: 20 },
  'scoring.group.cashflow.dti.score_high':          { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'DTI Score – High', unit: 'pts', minValue: 0, maxValue: 20 },
  'scoring.group.cashflow.dti.threshold_excellent': { dataType: 'PERCENTAGE',   category: 'Credit Scoring – Cashflow', label: 'DTI Threshold – Excellent',   unit: '% DTI', minValue: 10, maxValue: 50, description: 'DTI below this % → Excellent band' },
  'scoring.group.cashflow.dti.threshold_good':      { dataType: 'PERCENTAGE',   category: 'Credit Scoring – Cashflow', label: 'DTI Threshold – Good',        unit: '% DTI', minValue: 20, maxValue: 60 },
  'scoring.group.cashflow.dti.threshold_acceptable':{ dataType: 'PERCENTAGE',   category: 'Credit Scoring – Cashflow', label: 'DTI Threshold – Acceptable',  unit: '% DTI', minValue: 30, maxValue: 70 },
  'scoring.group.cashflow.dti.threshold_high':      { dataType: 'PERCENTAGE',   category: 'Credit Scoring – Cashflow', label: 'DTI Threshold – High (Max)',   unit: '% DTI', minValue: 40, maxValue: 80 },
  'scoring.group.cashflow.dti.score_max':           { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'DTI Max Score',     unit: 'pts', minValue: 5, maxValue: 30, isEditable: false, description: 'Component cap – change with care' },

  // Cashflow – M-Pesa
  'scoring.group.cashflow.mpesa.score_strong':    { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'M-Pesa Score – Strong',   unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.cashflow.mpesa.score_good':       { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'M-Pesa Score – Good',     unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.cashflow.mpesa.score_moderate':   { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'M-Pesa Score – Moderate', unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.cashflow.mpesa.score_low':         { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'M-Pesa Score – Low',      unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.cashflow.mpesa.threshold_strong':  { dataType: 'AMOUNT_KES',   category: 'Credit Scoring – Cashflow', label: 'M-Pesa Threshold – Strong',  unit: 'KES/mo', minValue: 5000, maxValue: 100000 },
  'scoring.group.cashflow.mpesa.threshold_good':    { dataType: 'AMOUNT_KES',   category: 'Credit Scoring – Cashflow', label: 'M-Pesa Threshold – Good',    unit: 'KES/mo', minValue: 2000, maxValue: 50000 },
  'scoring.group.cashflow.mpesa.threshold_moderate':{ dataType: 'AMOUNT_KES',   category: 'Credit Scoring – Cashflow', label: 'M-Pesa Threshold – Moderate',unit: 'KES/mo', minValue: 1000, maxValue: 20000 },
  'scoring.group.cashflow.mpesa.score_max':         { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'M-Pesa Max Score', unit: 'pts', minValue: 5, maxValue: 20, isEditable: false },

  // Cashflow – Savings Group
  'scoring.group.cashflow.group.score_active':    { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'Group Score – Active',    unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.cashflow.group.score_regular':   { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'Group Score – Regular',   unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.cashflow.group.score_minimal':   { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'Group Score – Minimal',   unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.cashflow.group.threshold_active': { dataType: 'AMOUNT_KES', category: 'Credit Scoring – Cashflow', label: 'Group Threshold – Active',  unit: 'KES/mo', minValue: 500, maxValue: 20000 },
  'scoring.group.cashflow.group.threshold_regular':{ dataType: 'AMOUNT_KES', category: 'Credit Scoring – Cashflow', label: 'Group Threshold – Regular', unit: 'KES/mo', minValue: 100, maxValue: 10000 },
  'scoring.group.cashflow.group.score_max':        { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Cashflow', label: 'Group Max Score', unit: 'pts', minValue: 5, maxValue: 20, isEditable: false },

  // Ability – Farm Size
  'scoring.group.ability.farm.score_large':  { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Farm Score – Large (≥5 acres)',  unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.ability.farm.score_medium': { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Farm Score – Medium (2-5 acres)',unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.ability.farm.score_small':  { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Farm Score – Small (1-2 acres)', unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.ability.farm.score_tiny':   { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Farm Score – Tiny (<1 acre)',    unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.ability.farm.threshold_large':  { dataType: 'NUMBER', category: 'Credit Scoring – Ability', label: 'Farm Threshold – Large',  unit: 'acres', minValue: 2, maxValue: 20 },
  'scoring.group.ability.farm.threshold_medium': { dataType: 'NUMBER', category: 'Credit Scoring – Ability', label: 'Farm Threshold – Medium', unit: 'acres', minValue: 0.5, maxValue: 10 },
  'scoring.group.ability.farm.threshold_small':  { dataType: 'NUMBER', category: 'Credit Scoring – Ability', label: 'Farm Threshold – Small',  unit: 'acres', minValue: 0.1, maxValue: 5 },
  'scoring.group.ability.farm.score_max':         { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Farm Max Score', unit: 'pts', isEditable: false },

  // Ability – Market Access
  'scoring.group.ability.market.score_contract':    { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Market Score – Contract',    unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.ability.market.score_cooperative': { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Market Score – Cooperative', unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.ability.market.score_local':       { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Market Score – Local Market', unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.ability.market.score_subsistence': { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Market Score – Subsistence',  unit: 'pts', minValue: 0, maxValue: 10 },
  'scoring.group.ability.market.bonus_irrigated':   { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Market Bonus – Irrigated',    unit: 'pts', minValue: 0, maxValue: 5 },
  'scoring.group.ability.market.score_max':          { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Market Max Score', unit: 'pts', isEditable: false },

  // Ability – Diversification
  'scoring.group.ability.divers.score_high':     { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Diversification – High',      unit: 'pts', minValue: 0, maxValue: 12 },
  'scoring.group.ability.divers.score_good':     { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Diversification – Good',      unit: 'pts', minValue: 0, maxValue: 12 },
  'scoring.group.ability.divers.score_multiple': { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Diversification – Multiple',  unit: 'pts', minValue: 0, maxValue: 12 },
  'scoring.group.ability.divers.score_some':     { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Diversification – Some',      unit: 'pts', minValue: 0, maxValue: 12 },
  'scoring.group.ability.divers.score_none':     { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Diversification – None',      unit: 'pts', minValue: 0, maxValue: 12 },
  'scoring.group.ability.divers.score_max':       { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'Diversification Max Score', unit: 'pts', isEditable: false },

  // Ability – LTIR
  'scoring.group.ability.ltir.score_very_manageable': { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'LTIR Score – Very Manageable',unit: 'pts', minValue: 0, maxValue: 12 },
  'scoring.group.ability.ltir.score_manageable':      { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'LTIR Score – Manageable',     unit: 'pts', minValue: 0, maxValue: 12 },
  'scoring.group.ability.ltir.score_stretching':      { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'LTIR Score – Stretching',     unit: 'pts', minValue: 0, maxValue: 12 },
  'scoring.group.ability.ltir.threshold_very':        { dataType: 'PERCENTAGE',   category: 'Credit Scoring – Ability', label: 'LTIR Threshold – Very Manageable', unit: '% annual income', minValue: 10, maxValue: 50 },
  'scoring.group.ability.ltir.threshold_manageable':  { dataType: 'PERCENTAGE',   category: 'Credit Scoring – Ability', label: 'LTIR Threshold – Manageable', unit: '% annual income', minValue: 20, maxValue: 70 },
  'scoring.group.ability.ltir.threshold_stretching':  { dataType: 'PERCENTAGE',   category: 'Credit Scoring – Ability', label: 'LTIR Threshold – Stretching', unit: '% annual income', minValue: 40, maxValue: 90 },
  'scoring.group.ability.ltir.score_max':              { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Ability', label: 'LTIR Max Score', unit: 'pts', isEditable: false },

  // Willingness – Yara
  'scoring.group.will.yara.score_4plus':        { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'Yara Score – 4+ years',        unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.will.yara.score_2to4':         { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'Yara Score – 2-4 years',       unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.will.yara.score_1to2':         { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'Yara Score – 1-2 years',       unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.will.yara.score_under1':       { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'Yara Score – Under 1 year',    unit: 'pts', minValue: 0, maxValue: 15 },
  'scoring.group.will.yara.score_none':         { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'Yara Score – Non-customer',    unit: 'pts', minValue: 0, maxValue: 10 },
  'scoring.group.will.yara.bonus_products':     { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'Yara Bonus – Multi-product',   unit: 'pts', minValue: 0, maxValue: 5 },
  'scoring.group.will.yara.threshold_4plus':    { dataType: 'NUMBER',       category: 'Credit Scoring – Willingness', label: 'Yara Threshold – 4+ years',    unit: 'years', minValue: 2, maxValue: 10 },
  'scoring.group.will.yara.threshold_2to4':     { dataType: 'NUMBER',       category: 'Credit Scoring – Willingness', label: 'Yara Threshold – 2 years',     unit: 'years', minValue: 1, maxValue: 5 },
  'scoring.group.will.yara.threshold_1to2':     { dataType: 'NUMBER',       category: 'Credit Scoring – Willingness', label: 'Yara Threshold – 1 year',      unit: 'years', minValue: 0.5, maxValue: 3 },
  'scoring.group.will.yara.products_threshold': { dataType: 'NUMBER',       category: 'Credit Scoring – Willingness', label: 'Yara Products – Bonus Count',  unit: 'products', minValue: 1, maxValue: 10 },
  'scoring.group.will.yara.score_max':           { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'Yara Max Score', unit: 'pts', isEditable: false },

  // Willingness – CRB
  'scoring.group.will.crb.score_clear_ontime':    { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'CRB Score – Clear + On-Time',    unit: 'pts', minValue: 0, maxValue: 20 },
  'scoring.group.will.crb.score_clear_nohistory': { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'CRB Score – Clear, No History',  unit: 'pts', minValue: 0, maxValue: 20 },
  'scoring.group.will.crb.score_clear_irregular': { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'CRB Score – Clear, Irregular',   unit: 'pts', minValue: 0, maxValue: 20 },
  'scoring.group.will.crb.score_performing':      { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'CRB Score – Performing',         unit: 'pts', minValue: 0, maxValue: 20 },
  'scoring.group.will.crb.score_unknown':         { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'CRB Score – Unknown Status',     unit: 'pts', minValue: 0, maxValue: 20 },
  'scoring.group.will.crb.score_listed':          { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'CRB Score – Listed (Negative)',  unit: 'pts', minValue: 0, maxValue: 0, isEditable: false, description: 'CRB-listed customers always score 0 – not editable' },
  'scoring.group.will.crb.score_max':             { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'CRB Max Score', unit: 'pts', isEditable: false },

  // Willingness – Social Capital
  'scoring.group.will.social.score_active':          { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'Social Score – Active Member',     unit: 'pts', minValue: 0, maxValue: 12 },
  'scoring.group.will.social.score_member':          { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'Social Score – Member',            unit: 'pts', minValue: 0, maxValue: 12 },
  'scoring.group.will.social.score_none':            { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'Social Score – No Group',          unit: 'pts', minValue: 0, maxValue: 5 },
  'scoring.group.will.social.savings_threshold':     { dataType: 'AMOUNT_KES',   category: 'Credit Scoring – Willingness', label: 'Social Savings Threshold – Active',unit: 'KES/mo', minValue: 500, maxValue: 20000 },
  'scoring.group.will.social.dependent_penalty':     { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'Dependent Penalty (per extra)',     unit: 'pts', minValue: 0, maxValue: 5, description: 'Score deduction per dependent over the threshold' },
  'scoring.group.will.social.dependent_threshold':   { dataType: 'NUMBER',       category: 'Credit Scoring – Willingness', label: 'Dependent Count Threshold',        unit: 'dependents', minValue: 3, maxValue: 10 },
  'scoring.group.will.social.score_max':             { dataType: 'SCORE_POINTS', category: 'Credit Scoring – Willingness', label: 'Social Capital Max Score', unit: 'pts', isEditable: false },

  // ── ILP Scoring ────────────────────────────────────────────────────────────
  'ilp.weight.owner':       { dataType: 'PERCENTAGE', category: 'ILP Scoring – Weights', label: 'Owner Quality Weight',       unit: '%', minValue: 5, maxValue: 50, description: 'Composite weight – all 5 weights must sum to 100%' },
  'ilp.weight.business':    { dataType: 'PERCENTAGE', category: 'ILP Scoring – Weights', label: 'Business Quality Weight',    unit: '%', minValue: 5, maxValue: 50 },
  'ilp.weight.operational': { dataType: 'PERCENTAGE', category: 'ILP Scoring – Weights', label: 'Operational Risk Weight',    unit: '%', minValue: 5, maxValue: 50 },
  'ilp.weight.cashflow':    { dataType: 'PERCENTAGE', category: 'ILP Scoring – Weights', label: 'Cash Flow Weight',           unit: '%', minValue: 5, maxValue: 50 },
  'ilp.weight.collateral':  { dataType: 'PERCENTAGE', category: 'ILP Scoring – Weights', label: 'Collateral Weight',          unit: '%', minValue: 5, maxValue: 30 },

  'ilp.threshold.approve':      { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Thresholds', label: 'ILP APPROVE Threshold',      unit: 'pts', minValue: 50, maxValue: 95 },
  'ilp.threshold.conditional':  { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Thresholds', label: 'ILP CONDITIONAL Threshold',  unit: 'pts', minValue: 40, maxValue: 80 },

  'ilp.cashflow.dsr.hard_block_pct': { dataType: 'PERCENTAGE', category: 'ILP Scoring – Thresholds', label: 'ILP DSR Hard Block',     unit: '%', minValue: 40, maxValue: 70, description: 'Applications with DSR ≥ this % are automatically declined' },
  'ilp.cashflow.dsr.score_under30':  { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Cash Flow', label: 'DSR Score – Under 30%',  unit: 'pts', minValue: 0, maxValue: 100 },
  'ilp.cashflow.dsr.score_30to35':   { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Cash Flow', label: 'DSR Score – 30-35%',     unit: 'pts', minValue: 0, maxValue: 100 },
  'ilp.cashflow.dsr.score_35to40':   { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Cash Flow', label: 'DSR Score – 35-40%',     unit: 'pts', minValue: 0, maxValue: 100 },
  'ilp.cashflow.dsr.score_40to45':   { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Cash Flow', label: 'DSR Score – 40-45%',     unit: 'pts', minValue: 0, maxValue: 100 },
  'ilp.cashflow.dsr.score_45plus':   { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Cash Flow', label: 'DSR Score – 45%+',       unit: 'pts', minValue: 0, maxValue: 0, isEditable: false },

  'ilp.collateral.score_over2':   { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Collateral', label: 'Collateral Score – >2× coverage',    unit: 'pts', minValue: 0, maxValue: 100 },
  'ilp.collateral.score_1p5to2':  { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Collateral', label: 'Collateral Score – 1.5-2× coverage', unit: 'pts', minValue: 0, maxValue: 100 },
  'ilp.collateral.score_1to1p5':  { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Collateral', label: 'Collateral Score – 1-1.5× coverage', unit: 'pts', minValue: 0, maxValue: 100 },
  'ilp.collateral.score_under1':  { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Collateral', label: 'Collateral Score – <1× coverage',    unit: 'pts', minValue: 0, maxValue: 100 },
  'ilp.collateral.bonus_title':   { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Collateral', label: 'Collateral Bonus – Title Deed',       unit: 'pts', minValue: 0, maxValue: 30 },
  'ilp.collateral.bonus_vehicle': { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Collateral', label: 'Collateral Bonus – Motor Vehicle',    unit: 'pts', minValue: 0, maxValue: 20 },
  'ilp.collateral.bonus_chattel': { dataType: 'SCORE_POINTS', category: 'ILP Scoring – Collateral', label: 'Collateral Bonus – Chattel',          unit: 'pts', minValue: 0, maxValue: 15 },

  // ── ILP Branch Eligibility ─────────────────────────────────────────────────
  'ilp.eligibility.max_par30_pct':       { dataType: 'PERCENTAGE', category: 'ILP Branch Eligibility', label: 'Max PAR-30 to Qualify',     unit: '%', minValue: 1, maxValue: 15, description: 'Portfolio at Risk (30+ days) must be below this' },
  'ilp.eligibility.min_retention_pct':   { dataType: 'PERCENTAGE', category: 'ILP Branch Eligibility', label: 'Min Customer Retention',     unit: '%', minValue: 50, maxValue: 95 },
  'ilp.eligibility.min_growth_pct':      { dataType: 'PERCENTAGE', category: 'ILP Branch Eligibility', label: 'Min Portfolio Growth',       unit: '%', minValue: 5, maxValue: 50 },
  'ilp.eligibility.max_active_segments': { dataType: 'NUMBER',     category: 'ILP Branch Eligibility', label: 'Max Active ILP Segments',    unit: 'segments', minValue: 1, maxValue: 5 },

  // ── KPI & Follow-Up ────────────────────────────────────────────────────────
  'kpi.followup.red_flag_days':    { dataType: 'DAYS', category: 'KPI & Follow-Up', label: 'Follow-Up – ≥1 RED Flag',      unit: 'days', minValue: 1, maxValue: 14 },
  'kpi.followup.two_yellow_days':  { dataType: 'DAYS', category: 'KPI & Follow-Up', label: 'Follow-Up – ≥2 YELLOW Flags',  unit: 'days', minValue: 7, maxValue: 21 },
  'kpi.followup.one_yellow_days':  { dataType: 'DAYS', category: 'KPI & Follow-Up', label: 'Follow-Up – 1 YELLOW Flag',    unit: 'days', minValue: 7, maxValue: 30 },
  'kpi.followup.no_flag_days':     { dataType: 'DAYS', category: 'KPI & Follow-Up', label: 'Follow-Up – No Flags',         unit: 'days', minValue: 14, maxValue: 60 },

  'kpi.flag.dsr.yellow_pct':           { dataType: 'PERCENTAGE', category: 'KPI & Follow-Up', label: 'DSR Flag – YELLOW Threshold',         unit: '%', minValue: 25, maxValue: 60 },
  'kpi.flag.dsr.red_pct':              { dataType: 'PERCENTAGE', category: 'KPI & Follow-Up', label: 'DSR Flag – RED Threshold',            unit: '%', minValue: 35, maxValue: 75 },
  'kpi.flag.arrears.red_days':         { dataType: 'DAYS',       category: 'KPI & Follow-Up', label: 'Arrears Flag – RED (days overdue)',    unit: 'days', minValue: 14, maxValue: 90 },
  'kpi.flag.arrears.yellow_days':      { dataType: 'DAYS',       category: 'KPI & Follow-Up', label: 'Arrears Flag – YELLOW (days overdue)',unit: 'days', minValue: 1, maxValue: 30 },
  'kpi.flag.business_score.red':       { dataType: 'SCORE_POINTS', category: 'KPI & Follow-Up', label: 'Business Score Flag – RED',         unit: 'pts', minValue: 20, maxValue: 80 },
  'kpi.flag.business_score.yellow':    { dataType: 'SCORE_POINTS', category: 'KPI & Follow-Up', label: 'Business Score Flag – YELLOW',      unit: 'pts', minValue: 30, maxValue: 90 },
  'kpi.flag.operational_risk.red':     { dataType: 'SCORE_POINTS', category: 'KPI & Follow-Up', label: 'Operational Risk Flag – RED',       unit: 'pts', minValue: 10, maxValue: 60 },
  'kpi.flag.operational_risk.yellow':  { dataType: 'SCORE_POINTS', category: 'KPI & Follow-Up', label: 'Operational Risk Flag – YELLOW',    unit: 'pts', minValue: 20, maxValue: 70 },
  'kpi.flag.collateral_score.yellow':  { dataType: 'SCORE_POINTS', category: 'KPI & Follow-Up', label: 'Collateral Score Flag – YELLOW',    unit: 'pts', minValue: 10, maxValue: 70 },
  'kpi.flag.years_in_biz.yellow':      { dataType: 'NUMBER',       category: 'KPI & Follow-Up', label: 'New Business Flag – Year Threshold',unit: 'years', minValue: 0.5, maxValue: 3 },

  // ── Data Quality ───────────────────────────────────────────────────────────
  'quality.name_sim.same_branch_threshold':  { dataType: 'PERCENTAGE', category: 'Data Quality', label: 'Name Similarity – Same-Branch Alert',  unit: '% match', minValue: 80, maxValue: 99, description: 'Jaro-Winkler score above this → flag as possible duplicate' },
  'quality.name_sim.cross_branch_threshold': { dataType: 'PERCENTAGE', category: 'Data Quality', label: 'Name Similarity – Cross-Branch Alert', unit: '% match', minValue: 75, maxValue: 99 },
  'quality.gps_radius_metres':               { dataType: 'NUMBER',     category: 'Data Quality', label: 'GPS Duplicate Radius',                 unit: 'metres', minValue: 5, maxValue: 100 },
  'quality.dob_window_days':                 { dataType: 'DAYS',       category: 'Data Quality', label: 'DOB Matching Window',                  unit: 'days',   minValue: 0, maxValue: 730, description: '±days around DOB to consider a match' },
  'quality.debt_service_ratio_pct':          { dataType: 'PERCENTAGE', category: 'Data Quality', label: 'Debt Service Ratio Flag',              unit: '%',      minValue: 30, maxValue: 80 },
  'quality.jaccard_threshold_pct':           { dataType: 'PERCENTAGE', category: 'Data Quality', label: 'Copy-Paste Detection (Jaccard)',        unit: '% overlap', minValue: 40, maxValue: 90, description: 'Word overlap above this → flag as copy-pasted' },
  'quality.rapid_app_window_minutes':        { dataType: 'NUMBER',     category: 'Data Quality', label: 'Rapid Application Window',             unit: 'minutes', minValue: 15, maxValue: 240 },
  'quality.rapid_app_count_max':             { dataType: 'NUMBER',     category: 'Data Quality', label: 'Rapid Application Count Max',          unit: 'apps', minValue: 2, maxValue: 10 },
  'quality.lookback_window_days':            { dataType: 'DAYS',       category: 'Data Quality', label: 'Loan Purpose Lookback Window',         unit: 'days', minValue: 30, maxValue: 365 },
  'quality.round_field_count':               { dataType: 'NUMBER',     category: 'Data Quality', label: 'Round-Number Field Count Threshold',   unit: 'fields', minValue: 2, maxValue: 8 },

  // ── Interview Scoring ──────────────────────────────────────────────────────
  'interview.weight.s1_personal':        { dataType: 'NUMBER', category: 'Interview Scoring', label: 'Weight – Personal / Background',       unit: 'weight', minValue: 1, maxValue: 5 },
  'interview.weight.s2_farming':         { dataType: 'NUMBER', category: 'Interview Scoring', label: 'Weight – Farming Activities',          unit: 'weight', minValue: 1, maxValue: 5 },
  'interview.weight.s3_financial':       { dataType: 'NUMBER', category: 'Interview Scoring', label: 'Weight – Financial Practices',         unit: 'weight', minValue: 1, maxValue: 5 },
  'interview.weight.s4_loan_purpose':    { dataType: 'NUMBER', category: 'Interview Scoring', label: 'Weight – Loan Purpose & Repayment',    unit: 'weight', minValue: 1, maxValue: 5 },
  'interview.weight.s5_character':       { dataType: 'NUMBER', category: 'Interview Scoring', label: 'Weight – Character Assessment',        unit: 'weight', minValue: 1, maxValue: 5 },
  'interview.weight.s6_risks':           { dataType: 'NUMBER', category: 'Interview Scoring', label: 'Weight – Risks & Responsibilities',    unit: 'weight', minValue: 1, maxValue: 5 },
  'interview.weight.s7_commitment':      { dataType: 'NUMBER', category: 'Interview Scoring', label: 'Weight – Commitment & Future Plans',   unit: 'weight', minValue: 1, maxValue: 5 },
  'interview.weight.s8_final':           { dataType: 'NUMBER', category: 'Interview Scoring', label: 'Weight – Final Thoughts',             unit: 'weight', minValue: 1, maxValue: 5 },

  'interview.threshold.approve_pct':            { dataType: 'PERCENTAGE', category: 'Interview Scoring', label: 'APPROVE Score Threshold',            unit: '%', minValue: 70, maxValue: 95 },
  'interview.threshold.conditional_pct':        { dataType: 'PERCENTAGE', category: 'Interview Scoring', label: 'CONDITIONAL Score Threshold',        unit: '%', minValue: 50, maxValue: 85 },
  'interview.threshold.further_evaluation_pct': { dataType: 'PERCENTAGE', category: 'Interview Scoring', label: 'FURTHER EVALUATION Score Threshold', unit: '%', minValue: 30, maxValue: 75 },
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding system_configs...\n');
  let created = 0, updated = 0, skipped = 0;

  for (const [key, defaultValue] of Object.entries(CONFIG_DEFAULTS)) {
    const meta = META[key];
    if (!meta) {
      console.warn(`  ⚠  No metadata for key "${key}" — skipping`);
      skipped++;
      continue;
    }

    await prisma.systemConfig.upsert({
      where: { key },
      create: {
        key,
        value:       String(defaultValue),
        dataType:    meta.dataType,
        category:    meta.category,
        label:       meta.label,
        description: meta.description,
        unit:        meta.unit,
        minValue:    meta.minValue,
        maxValue:    meta.maxValue,
        isEditable:  meta.isEditable ?? true,
      },
      // On update: refresh metadata (label, description, etc.) but PRESERVE value
      // so live system edits are not overwritten by re-running the seed.
      update: {
        dataType:    meta.dataType,
        category:    meta.category,
        label:       meta.label,
        description: meta.description,
        unit:        meta.unit,
        minValue:    meta.minValue,
        maxValue:    meta.maxValue,
        isEditable:  meta.isEditable ?? true,
        // ← value intentionally NOT updated
      },
    });

    const existed = await prisma.systemConfig.findUnique({ where: { key } });
    if (existed?.value === String(defaultValue)) created++;
    else updated++;
  }

  console.log(`✅  system_configs seeded: ${created + updated} rows (${skipped} skipped for missing meta)`);
  console.log('    Re-running is safe — live overrides to values are preserved.\n');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
