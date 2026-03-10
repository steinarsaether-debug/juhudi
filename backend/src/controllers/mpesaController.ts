// ─── M-Pesa Statement Controller ─────────────────────────────────────────────
// Handles upload, parsing (PDF or CSV), and AI-powered analysis of customer
// M-Pesa statements to detect hidden loans, gambling, second-household support,
// and other financial risk indicators.
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';
import { encrypt, decrypt } from '../services/encryption';
import { config } from '../config';
import { asyncHandler } from '../utils/asyncHandler';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Multer setup (memory storage – we read before writing to disk) ────────────

const mpesaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve(config.UPLOAD_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.enc`),
});

export const mpesaUpload = multer({
  storage: mpesaStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB – larger than KYC docs
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/csv', 'text/plain', 'application/octet-stream'];
    // Some browsers send CSV as text/plain or application/octet-stream
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(file.mimetype) || ext === '.csv' || ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new AppError(400, `File type ${file.mimetype} not allowed. Upload PDF or CSV.`) as unknown as null, false);
    }
  },
});

// ── M-Pesa Transaction Parser ─────────────────────────────────────────────────
// Handles both Safaricom PDF-extracted text and CSV statement exports.

interface ParsedTx {
  date:        string;  // raw date string from statement
  description: string;
  credit:      number;  // money received
  debit:       number;  // money sent/spent
  balance:     number;
}

interface ParsedStatement {
  transactions:  ParsedTx[];
  periodStart:   Date | null;
  periodEnd:     Date | null;
  rawText:       string;
}

function cleanAmount(s: string): number {
  if (!s || s.trim() === '') return 0;
  // Remove commas, spaces, "KES", currency symbols
  const cleaned = s.replace(/[,\s]/g, '').replace(/^KES/i, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
}

function parseCsv(text: string): ParsedStatement {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions: ParsedTx[] = [];
  let headerIdx = -1;

  // Find the header row (contains "Receipt" and "Details")
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('receipt') && lower.includes('details')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx < 0) return { transactions, periodStart: null, periodEnd: null, rawText: text };

  // Parse header to find column positions
  const headers = lines[headerIdx].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
  const colIdx = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));

  const dateCol    = colIdx(['completion time', 'date', 'time']);
  const descCol    = colIdx(['details', 'description', 'narration']);
  const creditCol  = colIdx(['paid in', 'credit', 'received', 'money in']);
  const debitCol   = colIdx(['withdrawn', 'debit', 'paid out', 'money out']);
  const balanceCol = colIdx(['balance']);

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) continue;
    const desc = descCol >= 0 ? cols[descCol] : '';
    if (!desc || desc.toLowerCase().includes('receipt no')) continue;

    transactions.push({
      date:        dateCol >= 0    ? cols[dateCol]           : '',
      description: desc,
      credit:      creditCol >= 0  ? cleanAmount(cols[creditCol])  : 0,
      debit:       debitCol >= 0   ? cleanAmount(cols[debitCol])   : 0,
      balance:     balanceCol >= 0 ? cleanAmount(cols[balanceCol]) : 0,
    });
  }

  const dates = transactions.map(t => new Date(t.date)).filter(d => !isNaN(d.getTime())).sort((a,b) => a.getTime()-b.getTime());
  return {
    transactions,
    periodStart: dates[0] ?? null,
    periodEnd:   dates[dates.length - 1] ?? null,
    rawText: text,
  };
}

function parsePdfText(text: string): ParsedStatement {
  const transactions: ParsedTx[] = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Safaricom PDF format: lines contain receipt number, date+time, description, status, amounts
  // Common pattern: XXXNNNNNNN  DD/MM/YYYY HH:MM  Description  Completed  amount  amount  balance
  // Or each field on adjacent line. We'll use regex to find transaction patterns.

  // Try to match lines containing a receipt number (alphanumeric ~10 chars) followed by date
  const txPattern = /^([A-Z0-9]{8,12})\s+(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\s+(.+?)\s+Completed\s+([\d,\.]*)\s+([\d,\.]*)\s+([\d,\.]*)\s*$/i;
  // Simpler pattern for lines with just date and description and amounts
  const simpleDatePattern = /(\d{1,2}\/\d{1,2}\/\d{4})/;

  for (const line of lines) {
    const m = line.match(txPattern);
    if (m) {
      transactions.push({
        date:        m[2],
        description: m[3].trim(),
        credit:      cleanAmount(m[4]),
        debit:       cleanAmount(m[5]),
        balance:     cleanAmount(m[6]),
      });
    }
  }

  // Fallback: try to find date-keyed lines
  if (transactions.length === 0) {
    // Look for lines with a date pattern and amount-like numbers
    for (let i = 0; i < lines.length; i++) {
      const dateMatch = lines[i].match(simpleDatePattern);
      if (!dateMatch) continue;

      // Combine current + next few lines to build a transaction
      const chunk = lines.slice(i, Math.min(i + 3, lines.length)).join(' ');
      const amounts = [...chunk.matchAll(/[\d,]+\.\d{2}/g)].map(m => cleanAmount(m[0]));
      if (amounts.length < 2) continue;

      transactions.push({
        date:        dateMatch[1],
        description: chunk.replace(simpleDatePattern, '').replace(/[\d,]+\.\d{2}/g, '').trim().slice(0, 120),
        credit:      amounts[0],
        debit:       amounts[1] ?? 0,
        balance:     amounts[amounts.length - 1] ?? 0,
      });
    }
  }

  const dates = transactions
    .map(t => {
      // Handle DD/MM/YYYY
      const parts = t.date.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (parts) return new Date(`${parts[3]}-${parts[2].padStart(2,'0')}-${parts[1].padStart(2,'0')}`);
      return new Date(t.date);
    })
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    transactions,
    periodStart: dates[0] ?? null,
    periodEnd:   dates[dates.length - 1] ?? null,
    rawText: text,
  };
}

async function extractFromFile(filePath: string, mimeType: string, originalName: string): Promise<ParsedStatement> {
  const ext = path.extname(originalName).toLowerCase();
  const isCSV = mimeType === 'text/csv' || ext === '.csv';
  const isPDF = mimeType === 'application/pdf' || ext === '.pdf';

  const fileBuffer = fs.readFileSync(filePath);

  if (isPDF) {
    const pdfData = await pdfParse(fileBuffer);
    return parsePdfText(pdfData.text);
  } else if (isCSV || mimeType === 'text/plain') {
    const text = fileBuffer.toString('utf8');
    return parseCsv(text);
  } else {
    // Try CSV first, then PDF
    const textAttempt = fileBuffer.toString('utf8');
    if (textAttempt.includes(',') && textAttempt.includes('Receipt')) {
      return parseCsv(textAttempt);
    }
    try {
      const pdfData = await pdfParse(fileBuffer);
      return parsePdfText(pdfData.text);
    } catch {
      return parseCsv(textAttempt);
    }
  }
}

// ── AI Analysis ───────────────────────────────────────────────────────────────

function buildTransactionSummary(parsed: ParsedStatement, statedIncome?: number): string {
  const txs = parsed.transactions.slice(0, 500); // Cap at 500 rows to stay in context window

  // Build pipe-delimited table (more token-efficient than JSON)
  const header = 'DATE       | DESCRIPTION                                    | CREDIT (KES) | DEBIT (KES)';
  const divider = '─'.repeat(90);
  const rows = txs.map(t =>
    `${t.date.padEnd(10)} | ${t.description.slice(0,46).padEnd(46)} | ${(t.credit||'').toString().padStart(12)} | ${(t.debit||'').toString().padStart(11)}`
  );

  const totalCredit  = txs.reduce((s, t) => s + t.credit, 0);
  const totalDebit   = txs.reduce((s, t) => s + t.debit, 0);
  const months       = parsed.periodStart && parsed.periodEnd
    ? Math.max(1, Math.round((parsed.periodEnd.getTime() - parsed.periodStart.getTime()) / (30 * 24 * 60 * 60 * 1000)))
    : 1;
  const avgInflow    = Math.round(totalCredit / months);
  const avgOutflow   = Math.round(totalDebit  / months);

  let summary = `STATEMENT SUMMARY\n`;
  summary += `Period: ${parsed.periodStart?.toISOString().split('T')[0] ?? 'unknown'} to ${parsed.periodEnd?.toISOString().split('T')[0] ?? 'unknown'} (~${months} months)\n`;
  summary += `Total transactions: ${txs.length}\n`;
  summary += `Total inflow: KES ${totalCredit.toLocaleString()} | Avg monthly inflow: KES ${avgInflow.toLocaleString()}\n`;
  summary += `Total outflow: KES ${totalDebit.toLocaleString()} | Avg monthly outflow: KES ${avgOutflow.toLocaleString()}\n`;
  if (statedIncome) {
    summary += `LO-stated monthly income: KES ${statedIncome.toLocaleString()}\n`;
  }
  summary += `\nTRANSACTION HISTORY (${txs.length} of ${parsed.transactions.length} shown)\n`;
  summary += `${divider}\n${header}\n${divider}\n${rows.join('\n')}\n${divider}\n`;

  return summary;
}

interface MpesaAnalysisResult {
  overallRiskLevel:   'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  recommendedAction:  'PROCEED' | 'ADDITIONAL_INFO' | 'CAUTION' | 'DECLINE';
  riskSummary:        string;
  periodCovered:      { start: string; end: string; months: number };
  incomeAnalysis:     { avgMonthlyInflow: number; avgMonthlyOutflow: number; statedIncomeComparison: string; notes: string };
  detectedLoans:      Array<{ lender: string; estimatedMonthlyPayment: number; occurrences: number; lastDate: string; concern: string }>;
  suspiciousPatterns: Array<{ type: string; description: string; severity: string; evidence: string; estimatedMonthly?: number }>;
  gamblingTransactions: Array<{ platform: string; totalAmount: number; frequency: string; months: number }>;
  fulizaUsage:        { count: number; totalBorrowed: number; concern: string } | null;
  positiveIndicators: string[];
}

// Default prompt – admin can override this via the SystemConfig table (key: mpesa_analysis_prompt)
export const DEFAULT_MPESA_PROMPT_PREFIX = `You are a credit risk analyst for Juhudi Kilimo, a Kenyan agricultural microfinance institution. Analyse the following M-Pesa transaction history for a smallholder farmer applying for a loan.`;

export const DEFAULT_MPESA_PROMPT_BODY = `

ANALYSIS INSTRUCTIONS:

1. HIDDEN LOAN REPAYMENTS – Look for payments to Kenyan digital/mobile lenders:
   • Digital lenders: Tala (SpreadMobile), Branch International, Zenka, Timiza (Absa), Haraka, Okolea, Zidisha
   • Telco credit: M-Shwari (NCBA), KCB M-Pesa, Equity Eazzy Loan, Co-op MCo-opCash
   • Fuliza: Any "Fuliza" entries = M-Pesa overdraft borrowing – HIGH CONCERN
   • SACCOs/MFIs: KWFT, Faulu, Vision Fund, Jitegemea, Unaitas
   • Generic: any description containing "loan repay", "instalment", "lipa loan", "kulipa mkopo"
   • Bank debits with consistent monthly timing (same amount, same recipient) may indicate loan EFT

2. SECOND HOUSEHOLD / SPLIT INCOME – Warning signs:
   • Same recipient name appearing regularly with significant amounts (possible second family/wife)
   • Regular school fees payments to multiple schools in different towns
   • Rent payments to a location inconsistent with stated address
   • Regular "send money" to same person monthly (over KES 3,000)

3. GAMBLING – Look for:
   • SportPesa, Betway Kenya, Odibets, Mozzart, Betin, Cheza, Betika, 1XBET
   • Any description with "BET", "JACKPOT", "STAKE"
   • Note: small occasional bets < KES 200 total/month = LOW risk; regular large bets = HIGH risk

4. ALCOHOL / SUBSTANCE PATTERNS:
   • Frequent transactions at bars/liquor stores (descriptions: "bar", "wines", "spirits")
   • Late-night withdrawals (after 22:00) occurring frequently

5. FULIZA USAGE (M-Pesa overdraft):
   • Count all "Fuliza" transactions (borrowing from M-Pesa overdraft)
   • High Fuliza usage means person is frequently cash-short

6. INCOME VERIFICATION:
   • What is the actual average monthly inflow from the M-Pesa data?
   • Does it match the stated income? Flag if actual is < 60% of stated

7. POSITIVE INDICATORS:
   • Regular salary/pay credits (consistent amounts monthly)
   • Regular SACCO savings contributions
   • School fees payments (shows responsible family planning)
   • Business payment receipts (Lipa na M-Pesa)
   • Consistent balance maintained

Respond ONLY with a valid JSON object in exactly this structure (no text outside JSON):

{
  "overallRiskLevel": "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH",
  "recommendedAction": "PROCEED" | "ADDITIONAL_INFO" | "CAUTION" | "DECLINE",
  "riskSummary": "<2-4 sentence plain English summary for the loan officer. Mention the most important findings.>",
  "periodCovered": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "months": <integer> },
  "incomeAnalysis": {
    "avgMonthlyInflow": <number>,
    "avgMonthlyOutflow": <number>,
    "statedIncomeComparison": "CONSISTENT" | "LOWER_THAN_STATED" | "HIGHER_THAN_STATED" | "UNKNOWN",
    "notes": "<brief note>"
  },
  "detectedLoans": [
    { "lender": "<name>", "estimatedMonthlyPayment": <number>, "occurrences": <integer>, "lastDate": "YYYY-MM-DD", "concern": "<brief note>" }
  ],
  "suspiciousPatterns": [
    { "type": "SECOND_HOUSEHOLD" | "GAMBLING" | "ALCOHOL" | "CASH_INTENSIVE" | "INCOME_INSTABILITY" | "OTHER", "description": "<string>", "severity": "LOW" | "MEDIUM" | "HIGH", "evidence": "<specific transactions or pattern>", "estimatedMonthly": <number or null> }
  ],
  "gamblingTransactions": [
    { "platform": "<name>", "totalAmount": <number>, "frequency": "<e.g. 2-3 times/week>", "months": <integer> }
  ],
  "fulizaUsage": { "count": <integer>, "totalBorrowed": <number>, "concern": "<string>" } | null,
  "positiveIndicators": ["<string>", ...]
}

Rules:
- Set overallRiskLevel to VERY_HIGH if total hidden loan payments exceed 30% of income, or if gambling > KES 5,000/month, or if second household strongly evidenced
- Set overallRiskLevel to HIGH if hidden loans are detected, gambling present, or Fuliza used > 5 times/month
- Set overallRiskLevel to MEDIUM if there are patterns worth discussing but no hard evidence
- Set overallRiskLevel to LOW if the statement looks clean and income is consistent
- recommendedAction DECLINE is only for VERY_HIGH risk with multiple serious indicators
- Be specific: cite actual transaction descriptions and dates where possible
- If the statement appears to be very short (< 20 transactions) or unreadable, note this in riskSummary and set recommendedAction to ADDITIONAL_INFO`;

async function getEffectivePrompt(): Promise<string> {
  // Check if admin has saved a custom prompt in the DB
  const config = await prisma.systemConfig.findUnique({
    where: { key: 'mpesa_analysis_prompt' },
    select: { value: true },
  });
  return config?.value ?? (DEFAULT_MPESA_PROMPT_PREFIX + DEFAULT_MPESA_PROMPT_BODY);
}

async function runAiAnalysis(transactionSummary: string, statementId: string): Promise<void> {
  // Mark as PROCESSING
  await prisma.mpesaStatement.update({
    where: { id: statementId },
    data:  { analysisStatus: 'PROCESSING' },
  });

  // Load prompt (admin-customisable or default)
  const basePrompt = await getEffectivePrompt();

  const prompt = `${basePrompt}

${transactionSummary}`;

  try {
    const response = await anthropic.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 2048,
      messages:   [{ role: 'user', content: prompt }],
    });

    const rawText = (response.content[0] as { text: string }).text ?? '';
    const jsonStr = rawText
      .replace(/^```(?:json)?\s*/im, '')
      .replace(/\s*```\s*$/im, '')
      .trim();

    const result: MpesaAnalysisResult = JSON.parse(jsonStr);

    // Validate minimum required fields
    if (!result.overallRiskLevel || !result.recommendedAction) {
      throw new Error('AI returned incomplete analysis');
    }

    await prisma.mpesaStatement.update({
      where: { id: statementId },
      data: {
        analysisStatus:      'COMPLETE',
        analysedAt:          new Date(),
        overallRiskLevel:    result.overallRiskLevel,
        riskSummary:         result.riskSummary,
        recommendedAction:   result.recommendedAction,
        detectedLoans:       result.detectedLoans        as object,
        suspiciousPatterns:  result.suspiciousPatterns   as object,
        gamblingTransactions:result.gamblingTransactions as object,
        positiveIndicators:  result.positiveIndicators   as object,
        fulizaUsageCount:    result.fulizaUsage?.count   ?? 0,
        avgMonthlyInflow:    result.incomeAnalysis.avgMonthlyInflow,
        avgMonthlyOutflow:   result.incomeAnalysis.avgMonthlyOutflow,
        avgMonthlyNet:       (result.incomeAnalysis.avgMonthlyInflow - result.incomeAnalysis.avgMonthlyOutflow),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.mpesaStatement.update({
      where: { id: statementId },
      data: {
        analysisStatus: 'FAILED',
        analysisError:  msg.slice(0, 500),
      },
    });
  }
}

// ── Controller Handlers ───────────────────────────────────────────────────────

export const uploadStatement = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  if (!req.file) throw new AppError(400, 'No file uploaded');

  const { customerId } = req.params;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, financialProfile: { select: { monthlyFarmIncome: true, monthlyOffFarmIncome: true } } },
  });
  if (!customer) throw new AppError(404, 'Customer not found');

  // Compute checksum on the file already on disk
  const fileBuffer = fs.readFileSync(req.file.path);
  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  // Duplicate detection
  const duplicate = await prisma.mpesaStatement.findFirst({
    where: { customerId, checksum },
    select: { id: true },
  });
  if (duplicate) {
    fs.unlinkSync(req.file.path); // Clean up duplicate file
    throw new AppError(409, 'This statement has already been uploaded (duplicate checksum)');
  }

  // Encrypt the stored path
  const encryptedPath = encrypt(req.file.path);

  // Parse transactions from the file
  let parsed: ParsedStatement = { transactions: [], periodStart: null, periodEnd: null, rawText: '' };
  try {
    parsed = await extractFromFile(req.file.path, req.file.mimetype, req.file.originalname);
  } catch (parseErr) {
    // Parsing failure is non-fatal; we still store the file and attempt AI analysis
    console.error('[Mpesa] Parse error:', parseErr);
  }

  const statement = await prisma.mpesaStatement.create({
    data: {
      customerId,
      uploadedById:    req.user.sub,
      fileName:        req.file.originalname,
      mimeType:        req.file.mimetype,
      sizeBytes:       req.file.size,
      checksum,
      filePathEnc:     encryptedPath,
      periodStart:     parsed.periodStart   ?? undefined,
      periodEnd:       parsed.periodEnd     ?? undefined,
      transactionCount: parsed.transactions.length,
    },
  });

  await writeAuditLog(req.user.sub, 'UPLOAD_MPESA_STATEMENT', 'mpesa_statements', statement.id, req);

  // Trigger AI analysis asynchronously (don't block the response)
  if (process.env.ANTHROPIC_API_KEY) {
    const statedIncome = customer.financialProfile
      ? (customer.financialProfile.monthlyFarmIncome + customer.financialProfile.monthlyOffFarmIncome)
      : undefined;

    setImmediate(() => {
      const summary = buildTransactionSummary(parsed, statedIncome);
      runAiAnalysis(summary, statement.id).catch(err =>
        console.error('[Mpesa] AI analysis error:', err),
      );
    });
  } else {
    await prisma.mpesaStatement.update({
      where: { id: statement.id },
      data: { analysisStatus: 'FAILED', analysisError: 'AI service not configured' },
    });
  }

  res.status(201).json({
    id:               statement.id,
    fileName:         statement.fileName,
    periodStart:      statement.periodStart,
    periodEnd:        statement.periodEnd,
    transactionCount: statement.transactionCount,
    analysisStatus:   statement.analysisStatus,
    message: parsed.transactions.length > 0
      ? `Parsed ${parsed.transactions.length} transactions. AI analysis queued.`
      : 'File uploaded. Could not parse transactions — AI analysis will attempt from raw content.',
  });
});

export const listStatements = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { customerId } = req.params;

  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) throw new AppError(404, 'Customer not found');

  const statements = await prisma.mpesaStatement.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, fileName: true, mimeType: true, sizeBytes: true,
      periodStart: true, periodEnd: true, transactionCount: true,
      analysisStatus: true, analysisError: true, analysedAt: true,
      overallRiskLevel: true, recommendedAction: true, riskSummary: true,
      avgMonthlyInflow: true, avgMonthlyOutflow: true, avgMonthlyNet: true,
      fulizaUsageCount: true, createdAt: true,
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
  });

  res.json(statements);
});

export const getStatement = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { customerId, statementId } = req.params;

  const stmt = await prisma.mpesaStatement.findFirst({
    where: { id: statementId, customerId },
    include: { uploadedBy: { select: { firstName: true, lastName: true } } },
  });
  if (!stmt) throw new AppError(404, 'Statement not found');

  await writeAuditLog(req.user.sub, 'VIEW_MPESA_STATEMENT', 'mpesa_statements', statementId, req);
  res.json(stmt);
});

export const retryAnalysis = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw new AppError(401, 'Authentication required');
  const { customerId, statementId } = req.params;

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AppError(503, 'AI service is not configured. Set ANTHROPIC_API_KEY in environment.');
  }

  const stmt = await prisma.mpesaStatement.findFirst({
    where: { id: statementId, customerId },
    select: {
      id: true, filePathEnc: true, fileName: true, mimeType: true,
      analysisStatus: true,
      customer: {
        select: {
          financialProfile: { select: { monthlyFarmIncome: true, monthlyOffFarmIncome: true } }
        },
      },
    },
  });
  if (!stmt) throw new AppError(404, 'Statement not found');
  if (stmt.analysisStatus === 'PROCESSING') {
    throw new AppError(409, 'Analysis already in progress');
  }

  // Re-parse the file
  const filePath = decrypt(stmt.filePathEnc);
  if (!fs.existsSync(filePath)) throw new AppError(410, 'Original file no longer available');

  const parsed = await extractFromFile(filePath, stmt.mimeType, stmt.fileName);
  const statedIncome = stmt.customer?.financialProfile
    ? (stmt.customer.financialProfile.monthlyFarmIncome + stmt.customer.financialProfile.monthlyOffFarmIncome)
    : undefined;

  setImmediate(() => {
    const summary = buildTransactionSummary(parsed, statedIncome);
    runAiAnalysis(summary, statementId).catch(err =>
      console.error('[Mpesa] Retry analysis error:', err),
    );
  });

  res.json({ message: 'Analysis requeued', statementId });
});
