import express from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead
} from '../controller/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All notification routes require login

// @route   GET /api/notifications
// @desc    Get user's recent notifications & unread count
router.get('/', getNotifications);

// @route   PUT /api/notifications/:id/read
// @desc    Mark a specific notification as read
router.put('/:id/read', markAsRead);

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
router.put('/read-all', markAllAsRead);

export default router;