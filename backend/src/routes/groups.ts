import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  toggleGroupStatus,
  addMember,
  removeMember,
} from '../controllers/groupController';

const router = Router();
router.use(authenticate);

router.get('/',                         listGroups);         // List all groups (role-scoped)
router.post('/',                        createGroup);        // Create a new group
router.get('/:id',                      getGroup);           // Group detail with members + loan history
router.patch('/:id',                    updateGroup);        // Edit group metadata
router.patch('/:id/toggle-active',      toggleGroupStatus);  // Soft-delete / re-activate

router.post('/:id/members',             addMember);          // Add a customer to the group
router.delete('/:id/members/:memberId', removeMember);       // Remove a member (soft delete)

export default router;
