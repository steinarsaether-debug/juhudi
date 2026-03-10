import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  mpesaUpload,
  uploadStatement,
  listStatements,
  getStatement,
  retryAnalysis,
} from '../controllers/mpesaController';

const router = Router({ mergeParams: true }); // mergeParams to inherit :customerId
router.use(authenticate);

// Scoped under /customers/:customerId/mpesa
router.get('/',                          listStatements);
router.post('/', mpesaUpload.single('statement'), uploadStatement);
router.get('/:statementId',              getStatement);
router.post('/:statementId/retry',       retryAnalysis);

export default router;
