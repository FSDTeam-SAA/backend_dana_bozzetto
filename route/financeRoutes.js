import express from 'express';
import {
  createFinance,
  getFinances,
  getFinanceById,
  updateFinanceStatus,
  updateFinance,
  deleteFinance
} from '../controller/financeController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All finance routes require login
router.use(protect);

// @route   GET /api/finance
// @desc    Get all financial records (with filters)
// @access  Private
router.get('/', getFinances);

// @route   POST /api/finance
// @desc    Create a new invoice/estimate/contract
// @access  Private (Admin Only)
router.post('/', authorize('admin'), createFinance);

// @route   GET /api/finance/:id
// @desc    Get single finance details
// @access  Private
router.get('/:id', getFinanceById);

// @route   PUT /api/finance/:id/status
// @desc    Update status (e.g., Admin marks as Paid, Client marks as Approved)
// @access  Private
router.put('/:id/status', updateFinanceStatus);

// @route   PUT /api/finance/:id
// @desc    Update finance record (Admin only)
// @access  Private
router.put('/:id', authorize('admin'), updateFinance);

// @route   DELETE /api/finance/:id
// @desc    Delete finance record (Admin only)
// @access  Private
router.delete('/:id', authorize('admin'), deleteFinance);

export default router;
