import express from 'express';
import { 
  allMessages, 
  sendMessage, 
  markAsRead // New Import
} from '../controller/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

// @route   GET /api/messages/:chatId
router.get('/:chatId', allMessages);

// @route   POST /api/messages
router.post('/', sendMessage);

// @route   PUT /api/messages/:chatId/read
router.put('/:chatId/read', markAsRead);

export default router;