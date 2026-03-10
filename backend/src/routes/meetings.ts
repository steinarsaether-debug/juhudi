import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  createMeeting, listMeetings, getMeeting,
  activateMeeting, addSessionToMeeting, reorderAgenda,
  startPresenting,
} from '../controllers/meetingController';

const router = Router();
router.use(authenticate);

router.post('/', authorize('BRANCH_MANAGER', 'ADMIN'), createMeeting);
router.get('/', listMeetings);
router.get('/:id', getMeeting);
router.patch('/:id/activate', authorize('BRANCH_MANAGER', 'ADMIN'), activateMeeting);
router.post('/:id/sessions', authorize('BRANCH_MANAGER', 'ADMIN'), addSessionToMeeting);
router.patch('/:id/agenda', authorize('BRANCH_MANAGER', 'ADMIN'), reorderAgenda);
router.patch('/sessions/:sessionId/present', authorize('BRANCH_MANAGER', 'ADMIN'), startPresenting);

export default router;
