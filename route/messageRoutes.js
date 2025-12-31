import express from 'express';
import { 
  allMessages, 
  uploadMessageAttachments,
  markAsRead 
} from '../controller/messageController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../utils/fileUpload.js';

const router = express.Router();

// router.use(protect);

// @route   GET /api/messages/:chatId
// @desc    Fetch message history
router.get('/:chatId', allMessages);

// @route   POST /api/messages/upload
// @desc    Upload file attachments (Returns URL to send via Socket)
router.post('/upload', upload.array('files', 5), uploadMessageAttachments);

// @route   PUT /api/messages/:chatId/read
// @desc    Mark messages as read
router.put('/:chatId/read', markAsRead);

export default router;