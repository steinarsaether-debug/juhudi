import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
  listUsers, createUser, updateUser, resetPassword, toggleUserActive,
  listBranches, createBranch, updateBranch, toggleBranchActive,
  listAuditLogs,
  submitLocationPing, getLocationPings,
  listMpesaAnalyses,
  getSystemConfig, upsertSystemConfig, deleteSystemConfig,
} from '../controllers/adminController';

const router = Router();
router.use(authenticate);

// ── Users ──────────────────────────────────────────────────────────────────────
router.get('/users',                    asyncHandler(listUsers));
router.post('/users',                   asyncHandler(createUser));
router.patch('/users/:id',              asyncHandler(updateUser));
router.post('/users/:id/reset-password', asyncHandler(resetPassword));
router.patch('/users/:id/toggle-active', asyncHandler(toggleUserActive));

// ── Branches ───────────────────────────────────────────────────────────────────
router.get('/branches',                    asyncHandler(listBranches));
router.post('/branches',                   asyncHandler(createBranch));
router.patch('/branches/:id',              asyncHandler(updateBranch));
router.patch('/branches/:id/toggle-active', asyncHandler(toggleBranchActive));

// ── Activity log ───────────────────────────────────────────────────────────────
router.get('/activity', asyncHandler(listAuditLogs));

// ── LO Location pings ──────────────────────────────────────────────────────────
router.post('/locations/ping', asyncHandler(submitLocationPing));  // any authenticated user
router.get('/locations',       asyncHandler(getLocationPings));    // admin / BM only

// ── M-Pesa analysis monitoring ─────────────────────────────────────────────────
router.get('/mpesa-analyses', asyncHandler(listMpesaAnalyses));

// ── System config (AI prompt tuning) ───────────────────────────────────────────
router.get('/config/:key',    asyncHandler(getSystemConfig));
router.put('/config/:key',    asyncHandler(upsertSystemConfig));
router.delete('/config/:key', asyncHandler(deleteSystemConfig));

export default router;
