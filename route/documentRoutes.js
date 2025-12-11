import express from 'express';
import {
  uploadDocument,
  getProjectDocuments,
  updateDocumentStatus,
  addComment
} from '../controller/documentController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../utils/fileUpload.js';

const router = express.Router();

router.use(protect);

router.post('/', upload.array('files', 10), uploadDocument);

router.get('/project/:projectId', getProjectDocuments);
router.put('/:id/status', updateDocumentStatus);
router.post('/:id/comments', addComment);

export default router;