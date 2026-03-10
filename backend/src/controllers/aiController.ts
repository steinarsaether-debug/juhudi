import { Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/errorHandler';
import { writeAuditLog } from '../middleware/audit';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
      model: 'claude-opus-4-5',
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
    const jsonStr = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
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
