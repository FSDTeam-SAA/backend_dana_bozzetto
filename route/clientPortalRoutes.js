import express from 'express';
import {
  getClientDashboard,
  getClientDocuments,
  addDocumentComment,
  getClientFinance,
  getClientApprovals,
  updateApprovalStatus
} from '../controller/clientPortalController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(authorize('client'));

// Dashboard
router.get('/dashboard', getClientDashboard);

// Documents (Strictly Deliverables)
router.get('/documents', getClientDocuments);
router.post('/documents/:id/comment', addDocumentComment);

// Finance (Quick Action + Widgets)
router.get('/finance', getClientFinance);

// Approvals (Deliverables in Review)
router.get('/approvals', getClientApprovals); 
router.put('/approvals/:id', updateApprovalStatus); // Approve, Reject, Revision

export default router;