import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  openSession, listSessions, getSession,
  castVote, addComment, decide,
  streamSession, getCasePresentation, updateLoNarrative,
  raiseFlag, resolveFlag, recordFlagOutcome,
  addCondition, verifyCondition,
  getFlagAccuracy,
} from '../controllers/bccController';

const router = Router();

// ── Analytics (before :id routes to avoid param collision) ────────────────────
router.get('/analytics/flag-accuracy', authenticate, authorize('BRANCH_MANAGER', 'ADMIN'), getFlagAccuracy);

// ── Sessions ──────────────────────────────────────────────────────────────────
router.use(authenticate);

router.post('/', authorize('BRANCH_MANAGER', 'ADMIN'), openSession);
router.get('/', listSessions);
router.get('/:id', getSession);
router.get('/:id/case', getCasePresentation);
router.patch('/:id/narrative', updateLoNarrative);

// SSE — no authenticate middleware; JWT validated inside handler via ?token=
router.get('/:sessionId/stream', streamSession);

// ── Voting ────────────────────────────────────────────────────────────────────
router.post('/:id/votes', authorize('BRANCH_MANAGER', 'SUPERVISOR', 'LOAN_OFFICER'), castVote);

// ── Comments ──────────────────────────────────────────────────────────────────
router.post('/:id/comments', addComment);

// ── BM close / override ───────────────────────────────────────────────────────
router.post('/:id/decide', authorize('BRANCH_MANAGER', 'ADMIN'), decide);

// ── Flags ─────────────────────────────────────────────────────────────────────
router.post('/:id/flags', raiseFlag);
router.patch('/:id/flags/:flagId/resolve', authorize('BRANCH_MANAGER', 'SUPERVISOR'), resolveFlag);
router.patch('/flags/:flagId/outcome', authorize('BRANCH_MANAGER', 'ADMIN'), recordFlagOutcome);

// ── Conditions ────────────────────────────────────────────────────────────────
router.post('/:id/conditions', authorize('BRANCH_MANAGER', 'ADMIN'), addCondition);
router.patch('/:id/conditions/:condId/verify', authorize('BRANCH_MANAGER', 'SUPERVISOR'), verifyCondition);

export default router;
