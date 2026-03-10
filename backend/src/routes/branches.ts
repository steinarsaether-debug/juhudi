import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (_req, res) => {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, county: true },
    orderBy: { name: 'asc' },
  });
  res.json(branches);
}));

export default router;
