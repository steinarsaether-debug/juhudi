import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';
import { prisma } from '../config/database';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── Model constants ───────────────────────────────────────────────────────────
const MODELS = {
  FAST:    'claude-haiku-4-5-20251001', // extraction, collections, score narrative
  QUALITY: 'claude-sonnet-4-6',         // customer synthesis, application review
} as const;

// ── Shared helpers ────────────────────────────────────────────────────────────

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

async function callClaude(model: string, prompt: string, maxTokens = 1024): Promise<string> {
  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = message.content.find((b) => b.type === 'text');
  return block?.type === 'text' ? block.text : '';
}

// ─── Farm Health Assessment ───────────────────────────────────────────────────

const healthAssessmentSchema = z.object({
  imageBase64: z.string().min(100, 'Image data required'),
  imageMimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
  subjectType: z.enum([
    'TEA', 'MAIZE', 'COFFEE', 'BEANS', 'BANANA', 'SWEET_POTATO',
    'DAIRY_COW', 'GOAT', 'CHICKEN', 'PIG', 'OTHER_CROP', 'OTHER_ANIMAL',
  ]),
  county: z.string().optional(),
  additionalContext: z.string().max(500).optional(),
});

const SUBJECT_LABELS: Record<string, string> = {
  TEA: 'tea plant',
  MAIZE: 'maize crop',
  COFFEE: 'coffee plant',
  BEANS: 'beans crop',
  BANANA: 'banana plant',
  SWEET_POTATO: 'sweet potato crop',
  DAIRY_COW: 'dairy cow',
  GOAT: 'goat',
  CHICKEN: 'chicken/poultry',
  PIG: 'pig',
  OTHER_CROP: 'crop plant',
  OTHER_ANIMAL: 'farm animal',
};

interface HealthAssessmentResponse {
  healthStatus: 'HEALTHY' | 'MILD_CONCERN' | 'MODERATE_CONCERN' | 'SEVERE_CONCERN';
  confidence: number;
  issues: string[];
  recommendations: string[];
  urgency: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMEDIATE';
  disclaimer: string;
  rawAnalysis?: string;
}

export const healthAssessment = asyncHandler(async (req: Request, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AppError(503, 'AI assessment service is not configured. Contact your administrator.');
  }

  const body = healthAssessmentSchema.parse(req.body);
  const subjectLabel = SUBJECT_LABELS[body.subjectType] ?? 'farm subject';
  const countyContext = body.county ? ` in ${body.county} county, Kenya` : ' in Kenya';
  const extraContext = body.additionalContext ? `\n\nAdditional context provided by the loan officer: ${body.additionalContext}` : '';

  const prompt = `You are an experienced agricultural extension officer${countyContext}. A loan officer has photographed a ${subjectLabel} and needs a health assessment to support a farm loan application.

Carefully analyse this photograph and respond ONLY with a valid JSON object in exactly this format:

{
  "healthStatus": "HEALTHY" | "MILD_CONCERN" | "MODERATE_CONCERN" | "SEVERE_CONCERN",
  "confidence": <integer 0-100>,
  "issues": [<list of specific visible problems, empty array if healthy>],
  "recommendations": [<list of prioritised actions for the farmer, empty array if none needed>],
  "urgency": "NONE" | "LOW" | "MEDIUM" | "HIGH" | "IMMEDIATE",
  "disclaimer": "<one-sentence note about limitations of photo-based assessment>"
}

Definitions:
- HEALTHY: No visible problems, plant/animal appears vigorous and normal
- MILD_CONCERN: Minor issues visible, not yet affecting yield/production significantly
- MODERATE_CONCERN: Clear problems that will affect yield/production if untreated
- SEVERE_CONCERN: Serious disease, pest damage, malnutrition or injury requiring urgent action
- IMMEDIATE urgency: Farmer should act within 24-48 hours to prevent loss${extraContext}

Respond with JSON only. No explanation text outside the JSON.`;

  let rawText = '';
  try {
    const message = await client.messages.create({
      model: MODELS.QUALITY,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: body.imageMimeType,
                data: body.imageBase64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    rawText = textBlock?.type === 'text' ? textBlock.text : '';

    // Strip markdown code fences if present
    const jsonStr = stripFences(rawText);
    const parsed = JSON.parse(jsonStr) as HealthAssessmentResponse;

    // Validate required fields exist
    if (!parsed.healthStatus || !parsed.urgency) {
      throw new Error('Incomplete response from AI model');
    }

    res.json({
      success: true,
      assessment: parsed,
      subjectType: body.subjectType,
      county: body.county ?? null,
      assessedAt: new Date().toISOString(),
    });
    if (req.user) {
      writeAuditLog(req.user.sub, 'AI_HEALTH_ASSESSMENT', 'ai_assessments', body.subjectType, req, {
        subjectType: body.subjectType,
        county: body.county ?? null,
        healthStatus: parsed.healthStatus,
        urgency: parsed.urgency,
      }).catch(() => undefined);
    }
  } catch (err: unknown) {
    // If JSON parse failed, return a structured error with the raw text for debugging
    if (err instanceof SyntaxError) {
      throw new AppError(502, 'AI service returned an unexpected response format. Please try again.');
    }
    // Anthropic API errors
    if (err instanceof Anthropic.APIError) {
      if (err.status === 400 && rawText === '') {
        throw new AppError(400, 'Image could not be processed. Ensure the photo is clear and under 1 MB.');
      }
      throw new AppError(502, `AI service error: ${err.message}`);
    }
    throw err;
  }
});

// ─── Customer AI Summary ──────────────────────────────────────────────────────

export const customerSummary = asyncHandler(async (req: Request, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError(503, 'AI service not configured');
  if (!req.user) throw new AppError(401, 'Authentication required');

  const { customerId } = req.params;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      farmProfile: true,
      financialProfile: true,
      creditScores: { orderBy: { createdAt: 'desc' }, take: 1 },
      loans: { orderBy: { createdAt: 'desc' }, take: 10, select: { status: true } },
      mpesaStatements: {
        where: { analysisStatus: 'COMPLETE' },
        orderBy: { periodEnd: 'desc' },
        take: 1,
        select: {
          overallRiskLevel: true, recommendedAction: true,
          detectedLoans: true, gamblingTransactions: true,
        },
      },
    },
  });

  if (!customer) throw new AppError(404, 'Customer not found');

  // DataQualityFlag uses string entityId (not a typed relation on Customer)
  const qualityFlags = await prisma.dataQualityFlag.findMany({
    where: { entityType: 'CUSTOMER', entityId: customerId, isResolved: false },
    select: { severity: true },
  });

  const score = customer.creditScores[0];
  const mpesa = customer.mpesaStatements[0];
  const activeLoans = customer.loans.filter((l) => l.status === 'ACTIVE').length;
  const defaultedLoans = customer.loans.filter((l) => l.status === 'DEFAULTED').length;
  const flagsBySeverity = qualityFlags.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});

  const dataSummary = [
    `Customer: ${customer.firstName} ${customer.lastName}, ${customer.gender ?? 'unknown gender'}, ${customer.county} county`,
    `KYC: ${customer.kycStatus} | AML: ${customer.amlStatus}`,
    customer.farmProfile
      ? `Farm: ${customer.farmProfile.farmSize} acres, primary crop: ${customer.farmProfile.primaryCrop}`
      : 'Farm: No farm profile',
    customer.financialProfile
      ? `Financial: Monthly farm income KES ${customer.financialProfile.monthlyFarmIncome ?? '?'}, Expenses KES ${customer.financialProfile.monthlyHouseholdExpenses ?? '?'}`
      : 'Financial: No financial profile',
    score
      ? `Credit score: ${score.totalScore}/100 — ${score.recommendation} (cashflow ${score.cashflowScore}, ability ${score.abilityScore}, willingness ${score.willingnessScore})`
      : 'Credit score: Not computed',
    `Loans: ${activeLoans} active, ${defaultedLoans} defaulted, ${customer.loans.length} total`,
    mpesa
      ? `M-Pesa: Risk ${mpesa.overallRiskLevel}, action ${mpesa.recommendedAction}, detected loans: ${mpesa.detectedLoans ? 'yes' : 'none'}, gambling: ${mpesa.gamblingTransactions ? 'detected' : 'none'}`
      : 'M-Pesa: Not analysed',
    `Quality flags (unresolved): ${JSON.stringify(flagsBySeverity)} (total: ${qualityFlags.length})`,
  ].join('\n');

  const prompt = `You are a senior credit risk analyst for Juhudi Kilimo, a Kenyan agricultural microfinance institution.

Based on the following customer data, provide a concise risk assessment:

${dataSummary}

Respond ONLY with valid JSON:
{
  "riskRating": "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH",
  "summary": "<2-3 sentence overall assessment for a loan officer>",
  "strengths": ["<up to 4 key positive factors>"],
  "concerns": ["<up to 4 key risk factors>"],
  "recommendedAction": "PROCEED" | "ADDITIONAL_INFO" | "CAUTION" | "DECLINE",
  "keyDataPoints": {
    "creditScore": <number or null>,
    "mpesaRisk": "<string or null>",
    "activeLoans": <number>,
    "unresolvedFlags": <number>
  },
  "generatedAt": "${new Date().toISOString()}"
}`;

  try {
    const raw = await callClaude(MODELS.QUALITY, prompt, 1024);
    const result = JSON.parse(stripFences(raw));
    writeAuditLog(req.user.sub, 'AI_CUSTOMER_SUMMARY', 'customers', customerId, req).catch(() => undefined);
    res.json(result);
  } catch (err) {
    if (err instanceof SyntaxError) throw new AppError(502, 'AI service returned an unexpected format');
    throw err;
  }
});

// ─── Application Review Brief ─────────────────────────────────────────────────

export const applicationReview = asyncHandler(async (req: Request, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError(503, 'AI service not configured');
  if (!req.user) throw new AppError(401, 'Authentication required');

  const { applicationId } = req.params;

  const app = await prisma.loanApplication.findUnique({
    where: { id: applicationId },
    include: {
      customer: {
        include: {
          farmProfile: true,
          financialProfile: true,
          creditScores: { orderBy: { createdAt: 'desc' }, take: 1 },
          mpesaStatements: {
            where: { analysisStatus: 'COMPLETE' },
            orderBy: { periodEnd: 'desc' },
            take: 1,
            select: { overallRiskLevel: true, detectedLoans: true },
          },
        },
      },
      ilpAssessment: true,
      bccSession: { select: { status: true, outcome: true, outcomeNotes: true } },
      collateral: { select: { collateralType: true, estimatedValueKes: true } },
    },
  });

  if (!app) throw new AppError(404, 'Loan application not found');

  // DataQualityFlag uses string entityId (not a typed relation on Customer)
  const qualityFlags = await prisma.dataQualityFlag.findMany({
    where: { entityType: 'CUSTOMER', entityId: app.customerId, isResolved: false },
    select: { severity: true, message: true },
  });

  const c = app.customer;
  const score = c.creditScores[0];
  const mpesa = c.mpesaStatements[0];
  const totalCollateral = app.collateral.reduce((s, col) => s + (col.estimatedValueKes ?? 0), 0);

  const dataSummary = [
    `Application: ${app.applicationNumber}, status: ${app.status}`,
    `Requested: KES ${app.requestedAmountKes}, term: ${app.termMonths} months, purpose: ${app.purposeOfLoan}`,
    `Customer: ${c.firstName} ${c.lastName}, KYC: ${c.kycStatus}, AML: ${c.amlStatus}`,
    c.farmProfile
      ? `Farm: ${c.farmProfile.farmSize} acres, ${c.farmProfile.primaryCrop}, ${c.farmProfile.landOwnership}`
      : 'Farm: No profile',
    c.financialProfile
      ? `Income: KES ${c.financialProfile.monthlyFarmIncome ?? '?'}/mo, Expenses: KES ${c.financialProfile.monthlyHouseholdExpenses ?? '?'}/mo`
      : 'Financial: No profile',
    score ? `Score: ${score.totalScore}/100 → ${score.recommendation}` : 'Score: Not computed',
    mpesa ? `M-Pesa: Risk ${mpesa.overallRiskLevel}, detected loans: ${mpesa.detectedLoans ? 'yes' : 'none'}` : 'M-Pesa: Not analysed',
    `Collateral: ${app.collateral.length} item(s), total est. KES ${totalCollateral.toLocaleString()}`,
    app.ilpAssessment
      ? `ILP: score ${(app.ilpAssessment as Record<string, unknown>).totalScore ?? 'n/a'}, eligible: ${(app.ilpAssessment as Record<string, unknown>).eligible ?? 'unknown'}`
      : 'ILP: Not assessed',
    app.bccSession
      ? `BCC: ${app.bccSession.status}, outcome: ${app.bccSession.outcome ?? 'pending'}`
      : 'BCC: Not yet held',
    `Quality flags: ${qualityFlags.length} unresolved — ${qualityFlags.slice(0, 3).map((f) => f.message).join('; ')}`,
  ].join('\n');

  const prompt = `You are a senior credit analyst at Juhudi Kilimo, a Kenyan agricultural microfinance institution. A loan officer needs a review brief before presenting this application to the credit committee.

${dataSummary}

Respond ONLY with valid JSON:
{
  "headline": "<one sentence summary of the application and primary risk>",
  "strengths": ["<up to 4 positive factors>"],
  "risks": ["<up to 4 risk factors>"],
  "outstandingQuestions": ["<up to 3 questions for the applicant>"],
  "suggestedConditions": ["<up to 3 approval conditions, empty array if not applicable>"],
  "recommendation": "APPROVE" | "CONDITIONAL" | "REJECT" | "MORE_INFO",
  "confidence": <integer 0-100>,
  "generatedAt": "${new Date().toISOString()}"
}`;

  try {
    const raw = await callClaude(MODELS.QUALITY, prompt, 1024);
    const result = JSON.parse(stripFences(raw));
    writeAuditLog(req.user.sub, 'AI_APPLICATION_REVIEW', 'loan_applications', applicationId, req).catch(() => undefined);
    res.json(result);
  } catch (err) {
    if (err instanceof SyntaxError) throw new AppError(502, 'AI service returned an unexpected format');
    throw err;
  }
});

// ─── Collections Recommendation ───────────────────────────────────────────────

export const collectionsRecommendation = asyncHandler(async (req: Request, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) throw new AppError(503, 'AI service not configured');
  if (!req.user) throw new AppError(401, 'Authentication required');

  const { loanId } = req.params;

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      customer: {
        select: {
          firstName: true, lastName: true, county: true,
          mpesaStatements: {
            where: { analysisStatus: 'COMPLETE' },
            orderBy: { periodEnd: 'desc' },
            take: 1,
            select: { overallRiskLevel: true },
          },
        },
      },
      collectionActions: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { actionType: true, notes: true, createdAt: true },
      },
    },
  });

  if (!loan) throw new AppError(404, 'Loan not found');

  const customer = loan.customer;
  const mpesaRisk = customer.mpesaStatements[0]?.overallRiskLevel ?? 'UNKNOWN';
  const daysPastDue = loan.daysInArrears ?? 0;
  const outstanding = loan.outstandingBalKes ?? loan.principalKes;

  const recentActions = loan.collectionActions
    .map((f) => `${new Date(f.createdAt).toLocaleDateString('en-KE')}: ${f.actionType} — ${f.notes ?? 'no notes'}`)
    .join('\n') || '  None recorded';

  const dataSummary = [
    `Customer: ${customer.firstName} ${customer.lastName}, ${customer.county}`,
    `Loan: KES ${outstanding.toLocaleString()} outstanding, ${daysPastDue} days past due`,
    `M-Pesa risk: ${mpesaRisk}`,
    `Recent collection actions:\n${recentActions}`,
  ].join('\n');

  const prompt = `You are a collections specialist for Juhudi Kilimo, a Kenyan agricultural microfinance institution.

${dataSummary}

Provide a concise collections recommendation. Respond ONLY with valid JSON:
{
  "priority": "LOW" | "MEDIUM" | "HIGH" | "URGENT",
  "recommendedAction": "CALL" | "VISIT" | "RESTRUCTURE" | "LEGAL" | "WRITE_OFF",
  "reasoning": "<2 sentences explaining the recommendation>",
  "suggestedMessage": "<SMS/WhatsApp message template in English, addressed to the customer by first name>",
  "escalate": <boolean — true if supervisor involvement is recommended>,
  "generatedAt": "${new Date().toISOString()}"
}`;

  try {
    const raw = await callClaude(MODELS.FAST, prompt, 512);
    const result = JSON.parse(stripFences(raw));
    writeAuditLog(req.user.sub, 'AI_COLLECTIONS_REC', 'loans', loanId, req).catch(() => undefined);
    res.json(result);
  } catch (err) {
    if (err instanceof SyntaxError) throw new AppError(502, 'AI service returned an unexpected format');
    throw err;
  }
});

// ─── Score Narrative (helper called by scoringController) ─────────────────────

export interface ScoreNarrativeInput {
  totalScore: number;
  cashflowScore: number;
  abilityScore: number;
  willingnessScore: number;
  recommendation: string;
  scoringNotes: string[];
  requestedAmountKes: number;
  maxLoanAmountKes: number;
  primaryCrop?: string;
  county?: string;
}

export async function generateScoreNarrative(input: ScoreNarrativeInput): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return '';
  try {
    const prompt = `You are a loan officer assistant at Juhudi Kilimo, a Kenyan agricultural microfinance institution.

A credit score has been computed. Write a 3-4 sentence plain-English explanation for the loan officer (not the customer). Be specific and factual.

Score: ${input.totalScore}/100 → ${input.recommendation}
Cashflow: ${input.cashflowScore}/40 | Ability: ${input.abilityScore}/30 | Willingness: ${input.willingnessScore}/30
Requested: KES ${input.requestedAmountKes.toLocaleString()}, Max recommended: KES ${input.maxLoanAmountKes.toLocaleString()}
${input.primaryCrop ? `Primary crop: ${input.primaryCrop}` : ''}
${input.county ? `County: ${input.county}` : ''}
Key notes: ${input.scoringNotes.slice(0, 3).join(' | ')}

Write 3-4 sentences only. No JSON. Plain text.`;

    const raw = await callClaude(MODELS.FAST, prompt, 256);
    return raw.trim();
  } catch {
    return '';
  }
}
