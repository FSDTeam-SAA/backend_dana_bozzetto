import express from 'express';
import {
  getUserSettings,
  updateUserSettings,
  changePassword
} from '../controller/settingsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // Apply protection to all routes

// @route   GET /api/settings
// @desc    Get current notification/language settings
router.get('/', getUserSettings);

// @route   PUT /api/settings
// @desc    Update notification/language settings
router.put('/', updateUserSettings);

// @route   PUT /api/settings/password
// @desc    Change login password
router.put('/password', changePassword);

export default router;