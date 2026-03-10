import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  upsertInterview,
  listAllInterviews,
  listInterviews,
  getInterview,
  deleteInterview,
  upsertILPInterview,
  getILPInterview,
} from '../controllers/interviewController';

const router = Router();
router.use(authenticate);

// Global interview list (LO sees own; BM sees branch; Admin sees all)
router.get('/',                                listAllInterviews); // GET /interviews

// ── ILP Interview routes (must come before /:customerId to avoid route conflicts) ──
router.post('/ilp/:customerId/:segment',       upsertILPInterview); // Create / update ILP interview
router.get('/ilp/:customerId/:segment',        getILPInterview);    // Get latest completed ILP interview

// Per-customer standard interview endpoints
router.post('/:customerId',                    upsertInterview);    // Create / update draft
router.get('/:customerId',                     listInterviews);     // All interviews for a customer
router.get('/single/:interviewId',             getInterview);       // Single interview by its own ID
router.delete('/single/:interviewId',          deleteInterview);    // Delete draft

export default router;
