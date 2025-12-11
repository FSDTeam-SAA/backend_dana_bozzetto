import express from 'express';
import {
  createTask,
  getProjectTasks,
  getMyTasks,
  updateTask,
  deleteTask
} from '../controller/taskController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// All task routes require the user to be logged in
router.use(protect);

// @route   POST /api/tasks
// @desc    Create a new task
router.post('/', createTask);

// @route   GET /api/tasks/my-tasks
// @desc    Get tasks assigned to the logged-in user (For Dashboard)
router.get('/my-tasks', getMyTasks);

// @route   GET /api/tasks/project/:projectId
// @desc    Get all tasks for a specific project
router.get('/project/:projectId', getProjectTasks);

// @route   PUT /api/tasks/:id
// @desc    Update task status (e.g. mark as Done) or details
router.put('/:id', updateTask);

// @route   DELETE /api/tasks/:id
// @desc    Delete a task
router.delete('/:id', deleteTask);

export default router;