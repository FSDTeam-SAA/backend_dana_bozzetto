import express from 'express';
import {
  getDashboardStats,
  getFinancialChartData,
  getMessageActivity,
  getAdminAgenda
} from '../controller/adminController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply protection and Admin authorization to ALL routes in this file
router.use(protect);
router.use(authorize('admin'));

// @route   GET /api/admin/stats
// @desc    Get top cards (Total Revenue, Clients, etc.) and Project Status donut chart
router.get('/stats', getDashboardStats);

// @route   GET /api/admin/financial-chart
// @desc    Get Monthly Paid vs Unpaid data for the bar chart
router.get('/financial-chart', getFinancialChartData);

// @route   GET /api/admin/message-activity
// @desc    Get message volume over the last 7 days for the line graph
router.get('/message-activity', getMessageActivity);

// @route   GET /api/admin/agenda
// @desc    Get Tasks and Projects for the calendar view (Alfredo Agenda)
router.get('/agenda', getAdminAgenda);

export default router;