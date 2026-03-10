/**
 * Default values for all tunable business constants.
 *
 * KEY CONVENTION:  category.subcategory.name
 *   - Values are stored exactly as shown here.
 *   - PERCENTAGE keys store the whole-number percent (e.g. 18 = 18%, not 0.18).
 *   - RATIO keys store the decimal (e.g. 0.40).
 *   - The seed-config.ts script reads this file to populate `system_configs`.
 *
 * ⚠️  Changing a value here only takes effect for NEW deployments (seed).
 *     For live systems, change via the Admin → System Config UI.
 */

export const CONFIG_DEFAULTS: Record<string, number | string | boolean> = {

  // ══════════════════════════════════════════════════════════════════════════
  // AWARD / LOYALTY TIERS
  // ══════════════════════════════════════════════════════════════════════════

  'award.bronze.min_cycles':       2,
  'award.bronze.max_arrears_days': 30,
  'award.bronze.rate_discount':    0.5,   // percentage points off p.a.
  'award.bronze.fee_discount':     10,    // % off processing fee

  'award.silver.min_cycles':       3,
  'award.silver.max_arrears_days': 14,
  'award.silver.rate_discount':    1.0,
  'award.silver.fee_discount':     20,

  'award.gold.min_cycles':         5,
  'award.gold.max_arrears_days':   7,
  'award.gold.rate_discount':      1.5,
  'award.gold.fee_discount':       30,

  'award.platinum.min_cycles':       7,
  'award.platinum.max_arrears_days': 0,
  'award.platinum.rate_discount':    2.0,
  'award.platinum.fee_discount':     40,

  // ══════════════════════════════════════════════════════════════════════════
  // GROUP LENDING – CREDIT SCORE THRESHOLDS & DECISIONS
  // ══════════════════════════════════════════════════════════════════════════

  'scoring.group.approve_threshold':      70,   // score pts
  'scoring.group.conditional_threshold':  50,
  'scoring.group.decline_threshold':      30,
  'scoring.group.supervisor_review_kes':  100000,
  'scoring.group.max_loan_ceiling_kes':   500000,
  'scoring.group.cbk_max_repayment_ratio': 40,  // % of net disposable income
  'scoring.group.monthly_rate_pct':        1.5,  // % per month ≈ 18% p.a.

  // Group Lending – Cashflow component (max 35 pts)
  // Debt-to-Income
  'scoring.group.cashflow.dti.score_excellent':  15,
  'scoring.group.cashflow.dti.score_good':        12,
  'scoring.group.cashflow.dti.score_acceptable':   8,
  'scoring.group.cashflow.dti.score_high':          4,
  'scoring.group.cashflow.dti.threshold_excellent': 30,  // % DTI below this → excellent
  'scoring.group.cashflow.dti.threshold_good':      40,
  'scoring.group.cashflow.dti.threshold_acceptable':50,
  'scoring.group.cashflow.dti.threshold_high':      60,
  'scoring.group.cashflow.dti.score_max':           15,

  // M-Pesa Activity
  'scoring.group.cashflow.mpesa.score_strong':    10,
  'scoring.group.cashflow.mpesa.score_good':       8,
  'scoring.group.cashflow.mpesa.score_moderate':   5,
  'scoring.group.cashflow.mpesa.score_low':         2,
  'scoring.group.cashflow.mpesa.threshold_strong': 20000,  // KES/month
  'scoring.group.cashflow.mpesa.threshold_good':   10000,
  'scoring.group.cashflow.mpesa.threshold_moderate': 5000,
  'scoring.group.cashflow.mpesa.score_max':         10,

  // Savings Group / Chama
  'scoring.group.cashflow.group.score_active':   10,
  'scoring.group.cashflow.group.score_regular':   7,
  'scoring.group.cashflow.group.score_minimal':   4,
  'scoring.group.cashflow.group.threshold_active': 3000,   // KES/month
  'scoring.group.cashflow.group.threshold_regular': 1000,
  'scoring.group.cashflow.group.score_max':        10,

  // Group Lending – Ability component (max 35 pts)
  // Farm Size
  'scoring.group.ability.farm.score_large':  10,
  'scoring.group.ability.farm.score_medium':  7,
  'scoring.group.ability.farm.score_small':   4,
  'scoring.group.ability.farm.score_tiny':    2,
  'scoring.group.ability.farm.threshold_large':  5,  // acres
  'scoring.group.ability.farm.threshold_medium': 2,
  'scoring.group.ability.farm.threshold_small':  1,
  'scoring.group.ability.farm.score_max':        10,

  // Market Access
  'scoring.group.ability.market.score_contract':    10,
  'scoring.group.ability.market.score_cooperative':  8,
  'scoring.group.ability.market.score_local':        5,
  'scoring.group.ability.market.score_subsistence':  1,
  'scoring.group.ability.market.bonus_irrigated':    1,
  'scoring.group.ability.market.score_max':         10,

  // Income Diversification
  'scoring.group.ability.divers.score_high':     8,
  'scoring.group.ability.divers.score_good':     6,
  'scoring.group.ability.divers.score_multiple': 4,
  'scoring.group.ability.divers.score_some':     3,
  'scoring.group.ability.divers.score_none':     1,
  'scoring.group.ability.divers.score_max':      8,

  // Loan-to-Income Ratio
  'scoring.group.ability.ltir.score_very_manageable': 7,
  'scoring.group.ability.ltir.score_manageable':      5,
  'scoring.group.ability.ltir.score_stretching':      2,
  'scoring.group.ability.ltir.threshold_very':       25,  // % of annual income
  'scoring.group.ability.ltir.threshold_manageable': 50,
  'scoring.group.ability.ltir.threshold_stretching': 75,
  'scoring.group.ability.ltir.score_max':             7,

  // Loan amount multipliers by score bucket [APPROVE, CONDITIONAL, DECLINE, STRONG_DECLINE]
  'scoring.group.multiplier.approve':      100,   // % of requested
  'scoring.group.multiplier.conditional':  80,
  'scoring.group.multiplier.decline':      60,

  // Recommended term (months)
  'scoring.group.term.irrigated_months':  12,
  'scoring.group.term.rain_fed_months':    6,

  // Group Lending – Willingness component (max 30 pts)
  // Yara Relationship
  'scoring.group.will.yara.score_4plus':      10,
  'scoring.group.will.yara.score_2to4':        8,
  'scoring.group.will.yara.score_1to2':        5,
  'scoring.group.will.yara.score_under1':      2,
  'scoring.group.will.yara.score_none':        1,
  'scoring.group.will.yara.bonus_products':    1,
  'scoring.group.will.yara.threshold_4plus':   4,  // years
  'scoring.group.will.yara.threshold_2to4':    2,
  'scoring.group.will.yara.threshold_1to2':    1,
  'scoring.group.will.yara.products_threshold':3,  // # products for bonus
  'scoring.group.will.yara.score_max':        10,

  // CRB / Credit History
  'scoring.group.will.crb.score_clear_ontime':  12,
  'scoring.group.will.crb.score_clear_nohistory': 8,
  'scoring.group.will.crb.score_clear_irregular': 5,
  'scoring.group.will.crb.score_performing':      9,
  'scoring.group.will.crb.score_unknown':         6,
  'scoring.group.will.crb.score_listed':          0,
  'scoring.group.will.crb.score_max':            12,

  // Social Capital
  'scoring.group.will.social.score_active':  8,
  'scoring.group.will.social.score_member':  5,
  'scoring.group.will.social.score_none':    0,
  'scoring.group.will.social.savings_threshold': 2000,  // KES/month
  'scoring.group.will.social.dependent_penalty': 2,     // pts per dependent > threshold
  'scoring.group.will.social.dependent_threshold': 6,   // # dependents
  'scoring.group.will.social.score_max':         8,

  // ══════════════════════════════════════════════════════════════════════════
  // ILP SCORING – COMPOSITE WEIGHTS & THRESHOLDS
  // ══════════════════════════════════════════════════════════════════════════

  'ilp.weight.owner':       20,   // % of composite
  'ilp.weight.business':    25,
  'ilp.weight.operational': 20,
  'ilp.weight.cashflow':    25,
  'ilp.weight.collateral':  10,

  'ilp.threshold.approve':      75,   // composite score pts
  'ilp.threshold.conditional':  60,

  // ILP Cash Flow – DSR (Debt Service Ratio)
  'ilp.cashflow.dsr.hard_block_pct':  50,   // % — hard stop
  'ilp.cashflow.dsr.score_under30':  100,
  'ilp.cashflow.dsr.score_30to35':    80,
  'ilp.cashflow.dsr.score_35to40':    60,
  'ilp.cashflow.dsr.score_40to45':    40,
  'ilp.cashflow.dsr.score_45plus':     0,

  // ILP Collateral – Coverage ratio scores
  'ilp.collateral.score_over2':   100,
  'ilp.collateral.score_1p5to2':   75,
  'ilp.collateral.score_1to1p5':   50,
  'ilp.collateral.score_under1':   20,
  'ilp.collateral.bonus_title':    20,
  'ilp.collateral.bonus_vehicle':  10,
  'ilp.collateral.bonus_chattel':   5,

  // ══════════════════════════════════════════════════════════════════════════
  // ILP BRANCH ELIGIBILITY
  // ══════════════════════════════════════════════════════════════════════════

  'ilp.eligibility.max_par30_pct':       5,   // %
  'ilp.eligibility.min_retention_pct':   70,
  'ilp.eligibility.min_growth_pct':      20,
  'ilp.eligibility.max_active_segments': 2,

  // ══════════════════════════════════════════════════════════════════════════
  // KPI – RISK FLAG THRESHOLDS & FOLLOW-UP CADENCE
  // ══════════════════════════════════════════════════════════════════════════

  // Follow-up frequency (days)
  'kpi.followup.red_flag_days':    7,
  'kpi.followup.two_yellow_days':  14,
  'kpi.followup.one_yellow_days':  21,
  'kpi.followup.no_flag_days':     30,

  // Flag thresholds
  'kpi.flag.dsr.yellow_pct':           40,   // % DSR → yellow
  'kpi.flag.dsr.red_pct':              50,   // % DSR → red
  'kpi.flag.arrears.red_days':         30,
  'kpi.flag.arrears.yellow_days':       7,
  'kpi.flag.business_score.red':       50,   // score pts below = red
  'kpi.flag.business_score.yellow':    65,
  'kpi.flag.operational_risk.red':     35,
  'kpi.flag.operational_risk.yellow':  50,
  'kpi.flag.collateral_score.yellow':  40,
  'kpi.flag.years_in_biz.yellow':       1,   // < 1 year = yellow

  // ══════════════════════════════════════════════════════════════════════════
  // DATA QUALITY – DETECTION THRESHOLDS
  // ══════════════════════════════════════════════════════════════════════════

  'quality.name_sim.same_branch_threshold':  92,   // % Jaro-Winkler
  'quality.name_sim.cross_branch_threshold': 88,
  'quality.gps_radius_metres':               15,
  'quality.dob_window_days':                365,
  'quality.debt_service_ratio_pct':          50,
  'quality.jaccard_threshold_pct':           65,
  'quality.rapid_app_window_minutes':        60,
  'quality.rapid_app_count_max':              3,
  'quality.lookback_window_days':            90,
  'quality.round_field_count':                3,

  // ══════════════════════════════════════════════════════════════════════════
  // INTERVIEW SCORING – SECTION WEIGHTS & THRESHOLDS
  // ══════════════════════════════════════════════════════════════════════════

  'interview.weight.s1_personal':        1,
  'interview.weight.s2_farming':         2,
  'interview.weight.s3_financial':       3,
  'interview.weight.s4_loan_purpose':    3,
  'interview.weight.s5_character':       3,
  'interview.weight.s6_risks':           2,
  'interview.weight.s7_commitment':      2,
  'interview.weight.s8_final':           1,

  'interview.threshold.approve_pct':           85,
  'interview.threshold.conditional_pct':       70,
  'interview.threshold.further_evaluation_pct':50,
};
