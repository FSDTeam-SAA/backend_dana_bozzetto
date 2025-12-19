import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  accessChat,
  fetchChats,
  createGroupChat,
} from '../controller/chatController.js';

const router = express.Router();

// Protect all routes
router.use(protect);

// @route   POST /api/chats
// @desc    Access a Chat (1-on-1) or create if not exists
router.post('/', accessChat);

// @route   GET /api/chats
// @desc    Fetch all chats for the logged-in user (Sidebar)
router.get('/', fetchChats);

// @route   POST /api/chats/group
// @desc    Create a Group Chat
router.post('/group', createGroupChat);

export default router;