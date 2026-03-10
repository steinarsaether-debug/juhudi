import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createCustomer, getCustomers, getCustomer, updateKYCStatus, updateCustomer, getCustomerRepayments,
  getCustomerTier,
} from '../controllers/customerController';

const router = Router();

router.use(authenticate);

router.post('/',           asyncHandler(createCustomer));
router.get('/',            asyncHandler(getCustomers));
router.get('/:id',         asyncHandler(getCustomer));
router.patch('/:id',              asyncHandler(updateCustomer));
router.patch('/:id/kyc',          authorize('SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN'), asyncHandler(updateKYCStatus));
router.get('/:id/repayments',     asyncHandler(getCustomerRepayments));
router.get('/:id/tier',           asyncHandler(getCustomerTier));

export default router;
