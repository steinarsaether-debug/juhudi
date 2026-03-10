import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
  applyForLoan, getLoanApplications, getLoanApplication, reviewApplication,
  disburseLoan, recordRepayment, getLoan, getLoanStats, getPortfolioStats,
} from '../controllers/loanController';

const router = Router();

router.use(authenticate);

router.get('/stats',                         asyncHandler(getLoanStats));
router.get('/portfolio',                     asyncHandler(getPortfolioStats));
router.post('/applications',                 asyncHandler(applyForLoan));
router.get('/applications',                  asyncHandler(getLoanApplications));
router.get('/applications/:id',              asyncHandler(getLoanApplication));
router.patch('/applications/:id/review',     authorize('SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN'), asyncHandler(reviewApplication));
router.post('/applications/:id/disburse',    authorize('SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN'), asyncHandler(disburseLoan));
router.get('/:id',                           asyncHandler(getLoan));
router.post('/:loanId/repayments',           asyncHandler(recordRepayment));

export default router;
