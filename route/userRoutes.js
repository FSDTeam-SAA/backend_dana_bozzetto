import express from 'express';
import {
  addTeamMember,
  addClient,
  getUsersByRole,
  getClientDashboard,
  deleteUser
} from '../controller/userController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../utils/fileUpload.js';

const router = express.Router();

// Apply protection to all routes
router.use(protect);

// @route   GET /api/users?role=...
// @desc    Get list of users (Clients or Team Members) with totalProjects count
router.get('/', getUsersByRole);

// @route   GET /api/users/client/:id/dashboard
// @desc    Get specific client dashboard stats (Widgets + Info)
router.get('/client/:id/dashboard', getClientDashboard);

// @route   POST /api/users/team-member
// @desc    Create Team Member (Admin only, supports Avatar upload)
router.post(
  '/team-member', 
  authorize('admin'), 
  upload.single('avatar'), 
  addTeamMember
);

// @route   POST /api/users/client
// @desc    Create Client (Admin only, supports Avatar upload)
router.post(
  '/client', 
  authorize('admin'), 
  upload.single('avatar'), 
  addClient
);

// @route   DELETE /api/users/:id
// @desc    Delete a user (Admin only)
router.delete('/:id', authorize('admin'), deleteUser);

export default router;