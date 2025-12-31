import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  accessChat,
  fetchChats,
} from '../controller/chatController.js';

const router = express.Router();

router.use(protect); 

// @route   POST /api/chats
// @desc    Access a Chat (User + Project combination)
router.post('/', accessChat);

// @route   GET /api/chats
// @desc    Get all chats for the user
router.get('/', fetchChats);

export default router;