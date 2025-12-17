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

// Documents (Quick Action)
router.get('/documents', getClientDocuments);
router.post('/documents/:id/comment', addDocumentComment);

// Finance (Quick Action + Widgets)
router.get('/finance', getClientFinance);

// Approvals (Quick Action + Process)
router.get('/approvals', getClientApprovals); // Get list (All/Pending)
router.put('/approvals/:id', updateApprovalStatus); // Approve, Reject, Revision

export default router;