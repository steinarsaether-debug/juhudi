import { Router } from 'express';
import authRoutes from './auth';
import customerRoutes from './customers';
import loanRoutes from './loans';
import scoringRoutes from './scoring';
import documentRoutes from './documents';
import branchRoutes from './branches';
import benchmarkRoutes from './benchmarks';
import aiRoutes from './ai';
import bccRoutes from './bcc';
import collectionsRoutes from './collections';
import qualityRoutes from './quality';
import interviewRoutes from './interviews';
import adminRoutes from './admin';
import groupRoutes from './groups';
import mpesaRoutes from './mpesa';
import ilpRoutes from './ilp';
import configRoutes from './config';
import meetingRoutes from './meetings';
import notificationRoutes from './notifications';
import weatherRoutes from './weather';
import { getLOWorklist } from '../controllers/ilpController';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use('/auth',          authRoutes);
router.use('/branches',      branchRoutes);
router.use('/customers',     customerRoutes);
router.use('/loans',         loanRoutes);
router.use('/scoring',       scoringRoutes);
router.use('/documents',     documentRoutes);
router.use('/benchmarks',    benchmarkRoutes);
router.use('/ai',            aiRoutes);
router.use('/bcc/meetings',  meetingRoutes);
router.use('/bcc',           bccRoutes);
router.use('/collections',   collectionsRoutes);
router.use('/quality',       qualityRoutes);
router.use('/interviews',    interviewRoutes);
router.use('/admin',         adminRoutes);
router.use('/groups',        groupRoutes);
router.use('/ilp',           ilpRoutes);
router.use('/config',        configRoutes);
router.use('/notifications', notificationRoutes);
router.use('/weather',       weatherRoutes);

// LO Worklist — cross-customer unified follow-up view
router.get('/lo/worklist', authenticate, asyncHandler(getLOWorklist));
router.use('/customers/:customerId/mpesa', mpesaRoutes);

export default router;
