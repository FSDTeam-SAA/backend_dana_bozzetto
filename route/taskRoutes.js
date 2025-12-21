import express from 'express';
import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  submitTask,
  reviewTask
} from '../controller/taskController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../utils/fileUpload.js';

const router = express.Router();

// All task routes require login
router.use(protect);

router.route('/')
  .post(authorize('admin', 'team_member'), createTask)
  .get(getTasks);

router.route('/:id')
  .put(authorize('admin', 'team_member'), updateTask)
  .delete(authorize('admin'), deleteTask);

// Submit Task (Team Member) - Uploads file
router.post(
  '/:id/submit',
  authorize('team_member'),
  upload.single('file'), // Standardized to 'file'
  submitTask
);

// Review Task (Admin) - Approve/Reject
router.put(
  '/:id/review',
  authorize('admin'),
  reviewTask
);

export default router;