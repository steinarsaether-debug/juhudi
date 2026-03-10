import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '@prisma/client';
import * as benchmarkController from '../controllers/benchmarkController';

const router = Router();

// All benchmark routes require authentication
router.use(authenticate);

// ── Data Sources ──────────────────────────────────────────────────────────────
router.get('/sources', benchmarkController.listSources);
router.post('/sources', authorize(UserRole.ADMIN), benchmarkController.createSource);
router.put('/sources/:id', authorize(UserRole.ADMIN), benchmarkController.updateSource);
router.delete('/sources/:id', authorize(UserRole.ADMIN), benchmarkController.deleteSource);

// ── Benchmark Items ───────────────────────────────────────────────────────────
router.get('/items', benchmarkController.listItems);
router.post('/items', authorize(UserRole.ADMIN, UserRole.BRANCH_MANAGER), benchmarkController.createItem);
router.put('/items/:id', authorize(UserRole.ADMIN, UserRole.BRANCH_MANAGER), benchmarkController.updateItem);
router.delete('/items/:id', authorize(UserRole.ADMIN), benchmarkController.deleteItem);

// ── Benchmark Values ──────────────────────────────────────────────────────────
// GET /api/benchmarks/values?category=CROP_INCOME&county=Kericho&year=2024
router.get('/values', benchmarkController.listValues);
router.post('/values', authorize(UserRole.ADMIN, UserRole.BRANCH_MANAGER), benchmarkController.createValue);
router.put('/values/:id', authorize(UserRole.ADMIN, UserRole.BRANCH_MANAGER), benchmarkController.updateValue);
router.delete('/values/:id', authorize(UserRole.ADMIN), benchmarkController.deleteValue);

// ── Lookup endpoint for loan officers ────────────────────────────────────────
// GET /api/benchmarks/lookup?category=CROP_INCOME&county=Kericho
// Returns most relevant values for a given filter
router.get('/lookup', benchmarkController.lookup);

// ── Summary / categories list ─────────────────────────────────────────────────
router.get('/categories', benchmarkController.getCategories);

export default router;
