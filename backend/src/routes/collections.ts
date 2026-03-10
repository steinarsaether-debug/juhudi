import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listArrears, getLoanCollections, logAction, collectionsSummary,
} from '../controllers/collectionsController';

const router = Router();
router.use(authenticate);

router.get('/summary',           collectionsSummary);
router.get('/arrears',           listArrears);
router.get('/:loanId',           getLoanCollections);
router.post('/:loanId/actions',  logAction);

export default router;
