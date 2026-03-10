import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { runCreditScore, getCustomerScores } from '../controllers/scoringController';

const router = Router();

router.use(authenticate);

router.post('/customers/:customerId',   asyncHandler(runCreditScore));
router.get('/customers/:customerId',    asyncHandler(getCustomerScores));

export default router;
