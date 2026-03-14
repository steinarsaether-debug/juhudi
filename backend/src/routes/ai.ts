import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import {
  healthAssessment,
  customerSummary,
  applicationReview,
  collectionsRecommendation,
} from '../controllers/aiController';

const router = Router();

// Strict rate limit: 10 requests/hour per user for photo assessment (Claude API cost)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'AI assessment rate limit reached. Please wait before submitting another photo.' },
  keyGenerator: (req) => (req as any).user?.sub ?? req.ip ?? 'unknown',
});

// Analytics rate limit: 30 requests/hour (lighter weight text-only calls)
const analyticsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'AI analytics rate limit reached. Please wait before requesting another summary.' },
  keyGenerator: (req) => (req as any).user?.sub ?? req.ip ?? 'unknown',
});

router.use(authenticate);

router.post('/health-assessment', aiLimiter, healthAssessment);

// Analytics summaries
router.get('/customer-summary/:customerId', analyticsLimiter, customerSummary);
router.get('/application-review/:applicationId', analyticsLimiter, applicationReview);
router.get('/collections-recommendation/:loanId', analyticsLimiter, collectionsRecommendation);

export default router;
