/**
 * KPI Monitoring Service — ILP Customer Risk Flags
 *
 * Derives individual KPI risk flags from ILP assessment data, farm/financial
 * profiles, and real-time repayment behaviour. Flags drive risk-based LO
 * follow-up frequency and appear on the unified LO worklist.
 *
 * Flag severity:
 *   YELLOW — Warning, increase follow-up frequency
 *   RED    — Critical, immediate LO action required
 *
 * Follow-up frequency:
 *   ≥1 RED flag     → 7-day check-in  (weekly)
 *   ≥2 YELLOW flags → 14-day check-in (bi-weekly)
 *   1 YELLOW flag   → 21-day check-in (three-weekly)
 *   No flags        → 30-day check-in (monthly)
 */
import { prisma } from '../config/database';
import { RiskFlagCategory, RiskFlagSeverity } from '@prisma/client';
import { configService } from './configService';

// ── Guidance lookup ────────────────────────────────────────────────────────────

interface FlagGuidance {
  questions: string[];
  actions:   string[];
}

const FLAG_GUIDANCE: Record<string, FlagGuidance> = {
  dsr_elevated: {
    questions: [
      'Have your income levels changed since the loan was approved?',
      'Are you experiencing any new financial obligations not disclosed earlier?',
      'Has your business revenue been consistent with your projections?',
    ],
    actions: [
      'Verify income with recent M-Pesa statement',
      'Update financial profile if income has changed',
      'Discuss whether loan restructuring is appropriate',
    ],
  },
  no_savings_buffer: {
    questions: [
      'Have you been able to set aside any savings since the loan was disbursed?',
      'What is your plan if you face an unexpected expense?',
    ],
    actions: [
      'Encourage joining a savings group (chama)',
      'Discuss M-Shwari or other micro-savings options',
    ],
  },
  shock_no_buffer: {
    questions: [
      'What was the nature of the income shock you experienced?',
      'How are you managing your loan repayments given this shock?',
      'Do you have any family support or alternative income to draw on?',
    ],
    actions: [
      'Escalate to Branch Manager for restructuring review',
      'Log as high-priority collection case',
      'Schedule field visit within 3 days',
    ],
  },
  single_income_source: {
    questions: [
      'Have you explored any additional income sources since the loan started?',
      'Is your primary income source performing as expected?',
    ],
    actions: [
      'Discuss diversification options with customer',
      'Refer to Yara agri-extension officer if farmer',
    ],
  },
  subsistence_market: {
    questions: [
      'Have you explored joining a cooperative or finding a contract buyer?',
      'What barriers prevent you from accessing better markets?',
      'Are there any local cooperatives you could join this season?',
    ],
    actions: [
      'Refer customer to Yara agri-extension officer',
      'Document market access plan agreed with customer',
      'Follow up on cooperative membership at next visit',
    ],
  },
  low_business_score: {
    questions: [
      'How is your business performing compared to your expectations when you applied?',
      'Have there been any major changes in your business since the loan was approved?',
      'What do you see as the main challenge for your business right now?',
    ],
    actions: [
      'Conduct detailed business review',
      'Escalate to Branch Manager if score is critically low',
      'Consider BM review before next cycle approval',
    ],
  },
  low_occupancy: {
    questions: [
      'What is your current occupancy rate?',
      'Have you experienced tenant turnover since the loan was disbursed?',
      'What steps are you taking to fill vacant units?',
    ],
    actions: [
      'Review tenant management practices',
      'Verify rental income is being maintained',
    ],
  },
  new_business: {
    questions: [
      'How is your business performing in its early stages?',
      'Are daily sales meeting your projections?',
      'Have you encountered any unexpected challenges?',
    ],
    actions: [
      'Increase visit frequency for first 3 months',
      'Verify stock deployment and sales records',
    ],
  },
  rain_fed_only: {
    questions: [
      'How is the current season progressing for your crop?',
      'Have you considered any drought-mitigation strategies?',
      'Is your crop on track for the expected yield?',
    ],
    actions: [
      'Monitor closely during dry spells',
      'Discuss crop insurance options',
      'Flag if drought declared in the area',
    ],
  },
  no_storage: {
    questions: [
      'Where are you storing your harvest?',
      'Are you experiencing post-harvest losses?',
      'Have you explored communal storage options?',
    ],
    actions: [
      'Discuss storage solutions and costs',
      'Refer to county extension office for storage grants',
    ],
  },
  no_insurance: {
    questions: [
      'Have you considered getting insurance for your business/farm?',
      'Are you aware of any affordable insurance products in this area?',
    ],
    actions: [
      'Provide information on Kilimo Salama or other products',
      'Discuss how insurance improves loan renewal eligibility',
    ],
  },
  high_operational_risk: {
    questions: [
      'What are the main operational risks your business faces currently?',
      'Have any of the risks identified at assessment time materialised?',
    ],
    actions: [
      'Conduct comprehensive field visit',
      'Update operational risk assessment notes',
      'Escalate to Branch Manager if risk has increased',
    ],
  },
  arrears_7d: {
    questions: [
      'What is preventing you from making the scheduled repayment?',
      'Is your business/farm generating expected revenue?',
      'Do you need a short grace period or restructuring discussion?',
    ],
    actions: [
      'Phone call within 24 hours',
      'Schedule field visit if no response within 48 hours',
      'Log collection action in the system',
    ],
  },
  arrears_30d: {
    questions: [
      'What has changed in your situation since the loan was approved?',
      'Are you able to make at least a partial repayment today?',
      'What is your realistic plan to become current on this loan?',
    ],
    actions: [
      'Immediate field visit required',
      'Escalate to Branch Manager',
      'Log formal demand notice',
      'Discuss restructuring or repayment plan',
    ],
  },
  weak_collateral: {
    questions: [
      'Has the value or condition of your collateral changed since approval?',
      'Are the collateral documents still valid and accessible?',
    ],
    actions: [
      'Verify collateral condition on next field visit',
      'Update collateral valuation if needed',
    ],
  },
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface KPIFlag {
  category:    RiskFlagCategory;
  severity:    RiskFlagSeverity;
  indicator:   string;
  title:       string;
  description: string;
  value?:      number;
  threshold?:  number;
}

// ── Frequency helper ───────────────────────────────────────────────────────────

export function computeFollowUpFrequency(
  redCount:    number,
  yellowCount: number,
): number {
  if (redCount >= 1)      return configService.int('kpi.followup.red_flag_days');    // weekly
  if (yellowCount >= 2)   return configService.int('kpi.followup.two_yellow_days');  // bi-weekly
  if (yellowCount >= 1)   return configService.int('kpi.followup.one_yellow_days');  // three-weekly
  return configService.int('kpi.followup.no_flag_days');                              // monthly (no flags)
}

// ── KPI derivation logic ───────────────────────────────────────────────────────

export async function deriveKPIFlags(
  loanId:        string,
  applicationId: string,
): Promise<void> {
  const [app, loan] = await Promise.all([
    prisma.loanApplication.findUnique({
      where:   { id: applicationId },
      include: { ilpAssessment: true },
    }),
    prisma.loan.findUnique({
      where:  { id: loanId },
      select: { customerId: true, daysInArrears: true },
    }),
  ]);

  if (!app || !loan || !app.ilpSegment) return;

  const customer = await prisma.customer.findUnique({
    where:   { id: loan.customerId },
    include: { farmProfile: true, financialProfile: true },
  });

  if (!customer) return;

  const flags: KPIFlag[] = [];
  const assessment = app.ilpAssessment;

  // ── FINANCIAL_CAPACITY ───────────────────────────────────────────────────────
  if (assessment) {
    const { cashFlowData } = assessment as { cashFlowData: Record<string, number> };
    const totalIncome    = cashFlowData?.totalMonthlyIncome as number | undefined;
    const existingDebt   = cashFlowData?.existingMonthlyDebt as number | undefined;
    const installment    = cashFlowData?.installment as number | undefined;

    if (totalIncome && existingDebt !== undefined && installment) {
      const dsr = ((existingDebt + installment) / totalIncome) * 100;
      const dsrYellow = configService.num('kpi.flag.dsr.yellow_pct');
      const dsrRed    = configService.num('kpi.flag.dsr.red_pct');
      if (dsr >= dsrYellow && dsr <= dsrRed) {
        flags.push({
          category:  'FINANCIAL_CAPACITY',
          severity:  'YELLOW',
          indicator: 'dsr_elevated',
          title:     'Elevated Debt Service Ratio',
          description: `DSR at ${dsr.toFixed(1)}% — approaching the ${dsrRed}% threshold`,
          value:     parseFloat(dsr.toFixed(1)),
          threshold: dsrYellow,
        });
      }
    }
  }

  if (app.hasSavingsBuffer === false) {
    flags.push({
      category:  'FINANCIAL_CAPACITY',
      severity:  'YELLOW',
      indicator: 'no_savings_buffer',
      title:     'No Emergency Savings Buffer',
      description: 'Customer reported no savings buffer at time of application',
    });
  }

  if (app.hadShockPastYear === true && app.hasSavingsBuffer === false) {
    flags.push({
      category:  'FINANCIAL_CAPACITY',
      severity:  'RED',
      indicator: 'shock_no_buffer',
      title:     'Income Shock with No Savings Buffer',
      description: `Experienced income shock (${app.shockType ?? 'unspecified'}) with no savings — high vulnerability`,
    });
  }

  const fp = customer.financialProfile;
  if (fp && (fp.monthlyOffFarmIncome ?? 0) === 0 && app.hasAlternativeIncome !== true) {
    flags.push({
      category:  'FINANCIAL_CAPACITY',
      severity:  'YELLOW',
      indicator: 'single_income_source',
      title:     'Single Income Source',
      description: 'No off-farm income or alternative income source reported — income concentration risk',
    });
  }

  // ── BUSINESS_PERFORMANCE ─────────────────────────────────────────────────────
  if (assessment) {
    const bizScoreRed    = configService.num('kpi.flag.business_score.red');
    const bizScoreYellow = configService.num('kpi.flag.business_score.yellow');
    if (assessment.businessScore < bizScoreRed) {
      flags.push({
        category:  'BUSINESS_PERFORMANCE',
        severity:  'RED',
        indicator: 'low_business_score',
        title:     'Low Business Assessment Score',
        description: `Business score of ${assessment.businessScore}/100 is below the ${bizScoreRed}-point threshold`,
        value:     assessment.businessScore,
        threshold: bizScoreRed,
      });
    } else if (assessment.businessScore < bizScoreYellow) {
      flags.push({
        category:  'BUSINESS_PERFORMANCE',
        severity:  'YELLOW',
        indicator: 'low_business_score',
        title:     'Low Business Assessment Score',
        description: `Business score of ${assessment.businessScore}/100 is below the ${bizScoreYellow}-point threshold`,
        value:     assessment.businessScore,
        threshold: bizScoreYellow,
      });
    }
  }

  const farm = customer.farmProfile;
  if (app.ilpSegment === 'FARMER' && farm) {
    if (farm.marketAccess === 'SUBSISTENCE') {
      flags.push({
        category:  'BUSINESS_PERFORMANCE',
        severity:  'YELLOW',
        indicator: 'subsistence_market',
        title:     'Subsistence-Only Market Access',
        description: 'Customer sells only at subsistence level — limited revenue reliability',
      });
    }
  }

  if (app.ilpSegment === 'SHOP_OWNER') {
    // Check years in business from interview answers if available
    const interviewAnswers = await prisma.customerInterview.findFirst({
      where: {
        customerId: loan.customerId,
        ilpSegment: 'SHOP_OWNER',
        status:     'COMPLETED',
      },
      select: { answers: true },
    });
    if (interviewAnswers?.answers) {
      const answers = interviewAnswers.answers as Record<string, unknown>;
      // Question S-A-1 captures years in business
      const yearsInBusiness = Number(answers['S-A-1'] ?? answers['years_in_business'] ?? 99);
      const yearsInBizYellow = configService.num('kpi.flag.years_in_biz.yellow');
      if (yearsInBusiness < yearsInBizYellow) {
        flags.push({
          category:  'BUSINESS_PERFORMANCE',
          severity:  'YELLOW',
          indicator: 'new_business',
          title:     'Business Less Than 1 Year Old',
          description: `Shop has been operating for less than ${yearsInBizYellow} year — elevated early-stage risk`,
          value:     yearsInBusiness,
          threshold: yearsInBizYellow,
        });
      }
    }
  }

  // ── OPERATIONAL_RISK ──────────────────────────────────────────────────────────
  if (assessment) {
    const opRiskRed    = configService.num('kpi.flag.operational_risk.red');
    const opRiskYellow = configService.num('kpi.flag.operational_risk.yellow');
    if (assessment.operationalRiskScore < opRiskRed) {
      flags.push({
        category:  'OPERATIONAL_RISK',
        severity:  'RED',
        indicator: 'high_operational_risk',
        title:     'High Operational Risk Score',
        description: `Operational risk score of ${assessment.operationalRiskScore}/100 — multiple risk factors present`,
        value:     assessment.operationalRiskScore,
        threshold: opRiskRed,
      });
    } else if (assessment.operationalRiskScore < opRiskYellow) {
      flags.push({
        category:  'OPERATIONAL_RISK',
        severity:  'YELLOW',
        indicator: 'no_insurance',
        title:     'Low Insurance Coverage',
        description: 'Operational risk score suggests limited or no insurance coverage',
        value:     assessment.operationalRiskScore,
        threshold: opRiskYellow,
      });
    }
  }

  if (app.ilpSegment === 'FARMER' && farm) {
    if (farm.irrigationType === 'RAIN_FED') {
      flags.push({
        category:  'OPERATIONAL_RISK',
        severity:  'YELLOW',
        indicator: 'rain_fed_only',
        title:     'Rain-Fed Farming Only',
        description: 'No irrigation — high exposure to drought and rainfall variability',
      });
    }
    if (!farm.hasStorageFacility) {
      flags.push({
        category:  'OPERATIONAL_RISK',
        severity:  'YELLOW',
        indicator: 'no_storage',
        title:     'No On-Farm Storage',
        description: 'No storage facility — risk of post-harvest losses and forced low-price selling',
      });
    }
  }

  // ── COLLATERAL_RISK ───────────────────────────────────────────────────────────
  if (assessment) {
    const collateralYellow = configService.num('kpi.flag.collateral_score.yellow');
    if (assessment.collateralScore < collateralYellow) {
      flags.push({
        category:  'COLLATERAL_RISK',
        severity:  'YELLOW',
        indicator: 'weak_collateral',
        title:     'Weak Collateral Position',
        description: `Collateral score of ${assessment.collateralScore}/100 — insufficient coverage`,
        value:     assessment.collateralScore,
        threshold: collateralYellow,
      });
    }
  }

  // ── Persist flags ─────────────────────────────────────────────────────────────
  if (flags.length === 0) return;

  await prisma.$transaction(
    flags.map(f =>
      prisma.customerRiskFlag.upsert({
        where:  { loanId_indicator: { loanId, indicator: f.indicator } },
        create: { ...f, loanId, customerId: loan.customerId },
        update: { ...f, isActive: true, resolvedAt: null, resolvedNote: null, resolvedById: null },
      }),
    ),
  );
}

// ── Refresh flags (called after repayment or follow-up completion) ─────────────

export async function refreshKPIFlags(loanId: string): Promise<{ created: number; resolved: number }> {
  const loan = await prisma.loan.findUnique({
    where:  { id: loanId },
    select: { customerId: true, daysInArrears: true, applicationId: true, ilpCycleNumber: true },
  });

  if (!loan || !loan.ilpCycleNumber) return { created: 0, resolved: 0 };

  let created  = 0;
  let resolved = 0;

  // ── Arrears flags (dynamic, based on current daysInArrears) ──────────────────
  const arrears = loan.daysInArrears;
  const arrearsRedDays    = configService.int('kpi.flag.arrears.red_days');
  const arrearsYellowDays = configService.int('kpi.flag.arrears.yellow_days');

  // arrears_30d
  if (arrears >= arrearsRedDays) {
    const flag = await prisma.customerRiskFlag.upsert({
      where:  { loanId_indicator: { loanId, indicator: 'arrears_30d' } },
      create: {
        loanId, customerId: loan.customerId,
        category: 'REPAYMENT_BEHAVIOR', severity: 'RED',
        indicator: 'arrears_30d',
        title:     `Loan ${arrearsRedDays}+ Days in Arrears`,
        description: `Loan is ${arrears} days overdue — immediate action required`,
        value:     arrears, threshold: arrearsRedDays,
      },
      update: {
        isActive: true, resolvedAt: null,
        description: `Loan is ${arrears} days overdue — immediate action required`,
        value: arrears,
      },
    });
    if (!flag.resolvedAt) created++;
  } else {
    // Auto-resolve if loan is now current
    const existing = await prisma.customerRiskFlag.findUnique({
      where: { loanId_indicator: { loanId, indicator: 'arrears_30d' } },
    });
    if (existing?.isActive) {
      await prisma.customerRiskFlag.update({
        where: { loanId_indicator: { loanId, indicator: 'arrears_30d' } },
        data:  { isActive: false, resolvedAt: new Date(), resolvedNote: 'Auto-resolved: loan brought current' },
      });
      resolved++;
    }
  }

  // arrears_7d (only if not already at red threshold)
  if (arrears >= arrearsYellowDays && arrears < arrearsRedDays) {
    await prisma.customerRiskFlag.upsert({
      where:  { loanId_indicator: { loanId, indicator: 'arrears_7d' } },
      create: {
        loanId, customerId: loan.customerId,
        category: 'REPAYMENT_BEHAVIOR', severity: 'YELLOW',
        indicator: 'arrears_7d',
        title:     `Loan ${arrearsYellowDays}+ Days in Arrears`,
        description: `Loan is ${arrears} days overdue`,
        value:     arrears, threshold: arrearsYellowDays,
      },
      update: {
        isActive: true, resolvedAt: null,
        description: `Loan is ${arrears} days overdue`,
        value: arrears,
      },
    });
    created++;
  } else if (arrears < arrearsYellowDays) {
    const existing = await prisma.customerRiskFlag.findUnique({
      where: { loanId_indicator: { loanId, indicator: 'arrears_7d' } },
    });
    if (existing?.isActive) {
      await prisma.customerRiskFlag.update({
        where: { loanId_indicator: { loanId, indicator: 'arrears_7d' } },
        data:  { isActive: false, resolvedAt: new Date(), resolvedNote: 'Auto-resolved: loan brought current' },
      });
      resolved++;
    }
  }

  return { created, resolved };
}

// ── Schedule KPI_CHECK follow-ups for active flags ────────────────────────────

export async function scheduleKPIFollowUps(
  loanId:      string,
  segment:     string,
  loanCycle:   number,
): Promise<void> {
  const activeFlags = await prisma.customerRiskFlag.findMany({
    where: { loanId, isActive: true },
  });

  if (activeFlags.length === 0) return;

  const redCount    = activeFlags.filter(f => f.severity === 'RED').length;
  const yellowCount = activeFlags.filter(f => f.severity === 'YELLOW').length;
  const daysAhead   = computeFollowUpFrequency(redCount, yellowCount);
  const dueDate     = new Date();
  dueDate.setDate(dueDate.getDate() + daysAhead);

  // Create one KPI_CHECK follow-up per active flag (if not already pending)
  for (const flag of activeFlags) {
    const existing = await prisma.iLPFollowUp.findFirst({
      where: {
        loanId,
        riskFlagId:  flag.id,
        isCompleted: false,
      },
    });

    if (existing) continue; // already has a pending task for this flag

    const guidance = FLAG_GUIDANCE[flag.indicator] ?? { questions: [], actions: [] };
    const questionsText = guidance.questions.map((q, i) => `${i + 1}. ${q}`).join('\n');

    await prisma.iLPFollowUp.create({
      data: {
        loanId,
        segment:      segment as never,
        loanCycle,
        scheduledDate: dueDate,
        visitType:    'KPI_CHECK',
        milestone:    `🚩 KPI Check — ${flag.title}`,
        riskFlagId:   flag.id,
        visitNotes:   questionsText ? `Suggested questions:\n${questionsText}` : undefined,
      },
    });
  }
}

// ── Get suggested guidance for a flag ────────────────────────────────────────

export function getFlagGuidance(indicator: string): FlagGuidance {
  return FLAG_GUIDANCE[indicator] ?? { questions: [], actions: [] };
}
