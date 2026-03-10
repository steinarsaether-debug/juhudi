import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { auditLog } from '../middleware/audit';
import { listConfigs, updateConfig, resetConfig } from '../controllers/configController';

const router = Router();

// All config endpoints require admin authentication
router.use(authenticate, authorize('ADMIN'));

router.get('/',            asyncHandler(listConfigs));
router.patch('/:key',      auditLog({ action: 'UPDATE_CONFIG', entity: 'system_configs' }), asyncHandler(updateConfig));
router.post('/reset/:key', asyncHandler(resetConfig));

export default router;
