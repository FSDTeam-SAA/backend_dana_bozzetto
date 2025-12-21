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

// @route   POST /api/documents
// @desc    Upload new document(s) - Supports multiple files
router.post('/', upload.array('files', 10), uploadDocument);

// @route   GET /api/documents/project/:projectId
// @desc    Get all documents for a specific project
router.get('/project/:projectId', getProjectDocuments);

// @route   PUT /api/documents/:id/status
// @desc    Update document status (e.g., Approved, Rejected)
router.put('/:id/status', updateDocumentStatus);

// @route   POST /api/documents/:id/comments
// @desc    Add a comment to a document
router.post('/:id/comments', addComment);

export default router;