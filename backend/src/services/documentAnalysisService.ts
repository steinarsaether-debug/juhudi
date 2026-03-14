// ─── Document Analysis Service ────────────────────────────────────────────────
// Triggered asynchronously after KYC document upload.
// Extracts text/fields from documents, validates against customer record,
// and raises DataQualityFlags for mismatches.
import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { decrypt } from './encryption';
import { extractDocumentContent } from './documentExtractionService';
import { logger } from '../utils/logger';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const FAST_MODEL = 'claude-haiku-4-5-20251001';

// ── Name similarity (Jaro-Winkler distance) ───────────────────────────────────

function jaroSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxDist = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  if (maxDist < 0) return 0;
  const aMatches = new Array(a.length).fill(false);
  const bMatches = new Array(b.length).fill(false);
  let matches = 0;
  let transpositions = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  return (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3;
}

function namesSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, '').trim();
  return jaroSimilarity(norm(a), norm(b)) >= 0.80;
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildPromptForDocType(
  docType: string,
  customerName: string,
): string {
  const base = `You are a KYC document verification specialist for a Kenyan microfinance institution.
Customer on file: ${customerName}
Respond ONLY with valid JSON — no explanation text outside the JSON.`;

  switch (docType) {
    case 'NATIONAL_ID_FRONT':
      return `${base}

Examine this Kenyan National ID (front) and extract all readable information.
{
  "id_number": "<string or null>",
  "full_name": "<string or null>",
  "date_of_birth": "<YYYY-MM-DD or null>",
  "gender": "<M|F or null>",
  "district_of_birth": "<string or null>",
  "serial_number": "<string or null>",
  "confidence": <0-100>,
  "image_quality": "GOOD" | "FAIR" | "POOR",
  "notes": "<issues with image or document, or empty string>"
}`;

    case 'NATIONAL_ID_BACK':
      return `${base}

Examine this Kenyan National ID (back) and extract:
{
  "id_number": "<string or null>",
  "address": "<string or null>",
  "confidence": <0-100>,
  "image_quality": "GOOD" | "FAIR" | "POOR",
  "notes": ""
}`;

    case 'KRA_PIN':
      return `${base}

Examine this Kenyan KRA PIN certificate and extract:
{
  "pin_number": "<string or null>",
  "full_name": "<string or null>",
  "tax_obligation": "<string or null>",
  "confidence": <0-100>,
  "image_quality": "GOOD" | "FAIR" | "POOR",
  "notes": ""
}`;

    case 'PASSPORT_PHOTO':
      return `${base}

Examine this passport biographical page and extract:
{
  "passport_number": "<string or null>",
  "full_name": "<string or null>",
  "date_of_birth": "<YYYY-MM-DD or null>",
  "expiry_date": "<YYYY-MM-DD or null>",
  "nationality": "<string or null>",
  "confidence": <0-100>,
  "image_quality": "GOOD" | "FAIR" | "POOR",
  "notes": ""
}`;

    case 'PROOF_OF_RESIDENCE':
      return `${base}

Examine this proof of residence document and extract:
{
  "resident_name": "<string or null>",
  "address": "<string or null>",
  "county": "<string or null>",
  "document_date": "<YYYY-MM-DD or null>",
  "issuer": "<string or null>",
  "confidence": <0-100>,
  "notes": ""
}`;

    case 'FARM_OWNERSHIP_PROOF':
      return `${base}

Examine this farm ownership or title deed document and extract:
{
  "owner_name": "<string or null>",
  "location": "<string or null>",
  "size_acres": <number or null>,
  "parcel_number": "<string or null>",
  "confidence": <0-100>,
  "notes": ""
}`;

    case 'BANK_STATEMENT':
      return `${base}

Examine this bank statement and extract key information and risk indicators:
{
  "account_holder": "<string or null>",
  "bank_name": "<string or null>",
  "account_number_last4": "<string or null>",
  "statement_period_start": "<YYYY-MM-DD or null>",
  "statement_period_end": "<YYYY-MM-DD or null>",
  "closing_balance": <number or null>,
  "currency": "KES",
  "average_monthly_inflow_estimate": <number or null>,
  "loan_repayments_detected": <boolean>,
  "gambling_transactions_detected": <boolean>,
  "risk_notes": "<summary of any concerning patterns, or empty string>",
  "confidence": <0-100>,
  "notes": ""
}`;

    case 'GROUP_MEMBERSHIP_CERT':
      return `${base}

Examine this group membership certificate and extract:
{
  "group_name": "<string or null>",
  "member_name": "<string or null>",
  "membership_date": "<YYYY-MM-DD or null>",
  "group_type": "<string or null>",
  "confidence": <0-100>,
  "notes": ""
}`;

    default:
      return `${base}

Examine this document and provide a general summary of its content:
{
  "document_type_detected": "<string>",
  "key_names": ["<names found in document>"],
  "key_dates": ["<dates found in YYYY-MM-DD format>"],
  "summary": "<2-3 sentence summary of document content>",
  "confidence": <0-100>,
  "notes": ""
}`;
  }
}

// ── Validation: compare extracted fields to customer record ───────────────────

// Map to actual Prisma FlagSeverity enum values: CRITICAL | WARNING | INFO
interface ValidationFlag {
  field: string;
  expected: string;
  found: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
}

function validateExtracted(
  docType: string,
  extracted: Record<string, unknown>,
  customer: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    county: string;
  },
): ValidationFlag[] {
  const flags: ValidationFlag[] = [];
  const customerName = `${customer.firstName} ${customer.lastName}`;

  const checkName = (found: unknown, fieldLabel: string, severity: 'CRITICAL' | 'WARNING' | 'INFO') => {
    if (typeof found === 'string' && found.length > 2) {
      if (!namesSimilar(found, customerName)) {
        flags.push({ field: fieldLabel, expected: customerName, found, severity });
      }
    }
  };

  const checkDob = (found: unknown) => {
    if (typeof found === 'string' && found.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const expectedDate = customer.dateOfBirth.toISOString().slice(0, 10);
      if (found !== expectedDate) {
        flags.push({ field: 'date_of_birth', expected: expectedDate, found, severity: 'CRITICAL' });
      }
    }
  };

  switch (docType) {
    case 'NATIONAL_ID_FRONT':
      checkName(extracted.full_name, 'full_name', 'WARNING');
      checkDob(extracted.date_of_birth);
      break;
    case 'NATIONAL_ID_BACK':
      // ID number is encrypted in DB; skip numeric comparison
      break;
    case 'KRA_PIN':
      checkName(extracted.full_name, 'full_name', 'WARNING');
      break;
    case 'PASSPORT_PHOTO':
      checkName(extracted.full_name, 'full_name', 'WARNING');
      checkDob(extracted.date_of_birth);
      break;
    case 'PROOF_OF_RESIDENCE':
      checkName(extracted.resident_name, 'resident_name', 'INFO');
      if (typeof extracted.county === 'string' && extracted.county.length > 2) {
        if (extracted.county.toLowerCase() !== customer.county.toLowerCase()) {
          flags.push({ field: 'county', expected: customer.county, found: extracted.county, severity: 'INFO' });
        }
      }
      break;
    case 'FARM_OWNERSHIP_PROOF':
      checkName(extracted.owner_name, 'owner_name', 'WARNING');
      break;
    case 'GROUP_MEMBERSHIP_CERT':
      checkName(extracted.member_name, 'member_name', 'INFO');
      break;
  }

  return flags;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function analyseDocument(documentId: string, customerId: string): Promise<void> {
  try {
    // Mark as PROCESSING immediately
    await prisma.kYCDocument.update({
      where: { id: documentId },
      data: { aiStatus: 'PROCESSING' },
    });

    const doc = await prisma.kYCDocument.findUnique({
      where: { id: documentId },
      include: {
        customer: {
          select: {
            id: true, firstName: true, lastName: true,
            dateOfBirth: true, county: true,
          },
        },
      },
    });

    if (!doc) throw new Error('Document not found');

    const filePath = decrypt(doc.filePathEnc);
    const { text, isImage, base64, mimeType: imageMime } = await extractDocumentContent(filePath, doc.mimeType);

    const prompt = buildPromptForDocType(
      doc.type,
      `${doc.customer.firstName} ${doc.customer.lastName}`,
    );

    // Build Claude message content
    type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
    type ContentBlock =
      | { type: 'text'; text: string }
      | { type: 'image'; source: { type: 'base64'; media_type: ImageMime; data: string } };

    const content: ContentBlock[] = isImage && base64 && imageMime
      ? [
          { type: 'image', source: { type: 'base64', media_type: imageMime, data: base64 } },
          { type: 'text', text: prompt },
        ]
      : [{ type: 'text', text: `${prompt}\n\nDocument content:\n${text.slice(0, 8000)}` }];

    const message = await client.messages.create({
      model: FAST_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    const rawText = textBlock?.type === 'text' ? textBlock.text : '';
    const jsonStr = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const extracted = JSON.parse(jsonStr) as Record<string, unknown>;

    // Validate extracted fields against customer record
    const validationFlags = validateExtracted(doc.type, extracted, doc.customer);

    // Persist results
    await prisma.kYCDocument.update({
      where: { id: documentId },
      data: {
        aiStatus: 'COMPLETE',
        aiExtractedText: isImage ? null : text.slice(0, 20000),
        aiExtractedFields: extracted as Prisma.InputJsonValue,
        aiValidationFlags: validationFlags as unknown as Prisma.InputJsonValue,
        aiAnalysedAt: new Date(),
      },
    });

    // Create DataQualityFlags for CRITICAL and WARNING severity mismatches
    for (const flag of validationFlags.filter((f) => f.severity !== 'INFO')) {
      const existing = await prisma.dataQualityFlag.findFirst({
        where: {
          entityType: 'CUSTOMER',
          entityId: customerId,
          flagType: 'DOCUMENT_MISMATCH',
          isResolved: false,
          message: { contains: flag.field },
        },
        select: { id: true },
      });
      const message = `Document mismatch: ${flag.field} on ${doc.type} reads "${flag.found}" but customer record shows "${flag.expected}"`;
      if (existing) {
        await prisma.dataQualityFlag.update({
          where: { id: existing.id },
          data: { message, details: { docId: documentId, ...flag } as Prisma.InputJsonValue },
        });
      } else {
        await prisma.dataQualityFlag.create({
          data: {
            entityType: 'CUSTOMER',
            entityId: customerId,
            flagType: 'DOCUMENT_MISMATCH',
            severity: flag.severity,
            message,
            details: { docId: documentId, ...flag } as Prisma.InputJsonValue,
          },
        });
      }
    }

    logger.info('Document AI analysis complete', { documentId, type: doc.type, flags: validationFlags.length });
  } catch (err) {
    logger.error('Document AI analysis failed', { documentId, err });
    await prisma.kYCDocument.update({
      where: { id: documentId },
      data: { aiStatus: 'FAILED' },
    }).catch(() => undefined);
  }
}
