import { Router } from 'express';
import { getBranchWeather, getAllBranchWeather } from '../controllers/weatherController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/branches',           getAllBranchWeather);
router.get('/branches/:branchId', getBranchWeather);

export default router;
