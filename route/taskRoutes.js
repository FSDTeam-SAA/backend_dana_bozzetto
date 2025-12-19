import express from 'express';
import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  submitTask, // New
  reviewTask  // New
} from '../controller/taskController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../utils/fileUpload.js';

const router = express.Router();

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
  upload.single('document'), // Matches field name in Postman/Frontend
  submitTask
);

// Review Task (Admin) - Approve/Reject
router.put(
  '/:id/review',
  authorize('admin'),
  reviewTask
);

export default router;