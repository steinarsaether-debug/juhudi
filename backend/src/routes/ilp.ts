import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getBranchILPEligibility,
  grantSegmentEligibility,
  updateSegmentStatus,
  saveILPAssessment,
  getILPAssessment,
  getILPFollowUpSchedule,
  completeFollowUp,
  getRiskFlags,
  resolveRiskFlag,
} from '../controllers/ilpController';

const router = Router();

// All ILP routes require authentication
router.use(authenticate);

// ── Branch Eligibility ────────────────────────────────────────────────────────
router.get('/branch-eligibility/:branchId',         asyncHandler(getBranchILPEligibility));
router.post('/branch-eligibility/:branchId/grant',  authorize('ADMIN'), asyncHandler(grantSegmentEligibility));
router.patch('/branch-eligibility/:branchId',       authorize('ADMIN'), asyncHandler(updateSegmentStatus));

// ── ILP Assessment ────────────────────────────────────────────────────────────
router.post('/assessment/:applicationId',            asyncHandler(saveILPAssessment));
router.get('/assessment/:applicationId',             asyncHandler(getILPAssessment));

// ── Follow-Up Schedule ────────────────────────────────────────────────────────
router.get('/follow-up/:loanId',                    asyncHandler(getILPFollowUpSchedule));
router.patch('/follow-up/:followUpId/complete',     asyncHandler(completeFollowUp));

// ── Risk Flags ────────────────────────────────────────────────────────────────
router.get('/risk-flags/:loanId',                asyncHandler(getRiskFlags));
router.patch('/risk-flags/:flagId/resolve',      authorize('BRANCH_MANAGER', 'SUPERVISOR', 'ADMIN'), asyncHandler(resolveRiskFlag));

export default router;
