import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  checkNameDuplicate,
  scanCustomer,
  scanApplication,
  getFlags,
  resolveFlag,
  qualityReport,
  runBranchScan,
} from '../controllers/qualityController';

const router = Router();
router.use(authenticate);

// Pre-check (used live from the onboarding form)
router.get('/check-name', checkNameDuplicate);

// Triggered scans
router.post('/scan/customer/:id',     scanCustomer);
router.post('/scan/application/:id',  scanApplication);

// Read flags
router.get('/flags/:entityType/:entityId', getFlags);

// Resolve / dismiss
router.patch('/flags/:flagId/resolve', resolveFlag);

// Report + full sweep
router.get('/report',    qualityReport);
router.post('/scan/branch', authorize('BRANCH_MANAGER', 'ADMIN'), runBranchScan);

export default router;
