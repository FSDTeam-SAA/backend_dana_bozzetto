import express from 'express';
import {
  getMemberDashboard,
  getMemberCalendar,
  searchGlobal,
  updateMemberTaskStatus
} from '../controller/teamMemberController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// All routes here are for logged-in Team Members
router.use(protect);
router.use(authorize('team_member'));

// @route   GET /api/team-portal/dashboard
// @desc    Get Homepage stats (Today's Tasks, Project Overview, Assigned Projects)
router.get('/dashboard', getMemberDashboard);

// @route   GET /api/team-portal/calendar
// @desc    Get tasks formatted for the monthly calendar view
router.get('/calendar', getMemberCalendar);

// @route   GET /api/team-portal/search?q=...
// @desc    Global search for Projects and Documents
router.get('/search', searchGlobal);

// @route   PUT /api/team-portal/tasks/:id/status
// @desc    Quick action: Mark task as Done or Dispute
router.put('/tasks/:id/status', updateMemberTaskStatus);

export default router;