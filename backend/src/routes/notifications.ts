import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listNotifications, getUnreadCount, markRead } from '../controllers/notificationController';

const router = Router();
router.use(authenticate);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read', markRead);

export default router;
