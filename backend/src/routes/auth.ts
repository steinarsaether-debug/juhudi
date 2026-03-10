import { Router } from 'express';
import { login, changePassword, getProfile, createUser } from '../controllers/authController';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.post('/login',           asyncHandler(login));
router.get('/profile',          authenticate, asyncHandler(getProfile));
router.post('/change-password', authenticate, asyncHandler(changePassword));
router.post('/users',           authenticate, authorize('ADMIN', 'BRANCH_MANAGER'), asyncHandler(createUser));

export default router;
