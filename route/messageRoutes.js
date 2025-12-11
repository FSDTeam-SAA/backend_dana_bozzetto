import express from 'express';
import {
  sendMessage,
  getMessages,
  getConversations
} from '../controller/messageController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.post('/', sendMessage);
router.get('/', getMessages);
router.get('/conversations', getConversations);

export default router;