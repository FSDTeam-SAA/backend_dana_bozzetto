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

// @route   GET /api/client-portal/dashboard
// @desc    Get Client Dashboard Stats & Activity
router.get('/dashboard', getClientDashboard);

// @route   GET /api/client-portal/documents
// @desc    Get All Deliverables (Supports ?milestone=...)
router.get('/documents', getClientDocuments);

// @route   POST /api/client-portal/documents/:id/comment
// @desc    Add feedback to a document
router.post('/documents/:id/comment', addDocumentComment);

// @route   GET /api/client-portal/finance
// @desc    Get Financial Records (Supports ?status=...)
router.get('/finance', getClientFinance);

// @route   GET /api/client-portal/approvals
// @desc    Get Pending Approvals (Supports ?status=...)
router.get('/approvals', getClientApprovals);

// @route   PUT /api/client-portal/approvals/:id
// @desc    Approve/Reject/Request Revision
router.put('/approvals/:id', updateApprovalStatus);

export default router;