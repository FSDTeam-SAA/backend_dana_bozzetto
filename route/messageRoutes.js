import express from 'express';
import { allMessages, sendMessage } from '../controller/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Protect all routes (Need req.user for messaging)
router.use(protect);

// @route   GET /api/messages/:chatId
// @desc    Fetch all messages for a specific chat
router.get('/:chatId', allMessages);

// @route   POST /api/messages
// @desc    Send a new message
router.post('/', sendMessage);

export default router;