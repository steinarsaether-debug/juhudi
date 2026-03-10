import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth';
import { healthAssessment } from '../controllers/aiController';

const router = Router();

// Strict rate limit: 10 requests/hour per user to control Claude API costs
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'AI assessment rate limit reached. Please wait before submitting another photo.' },
  keyGenerator: (req) => (req as any).user?.sub ?? req.ip ?? 'unknown',
});

router.use(authenticate);

router.post('/health-assessment', aiLimiter, healthAssessment);

export default router;
