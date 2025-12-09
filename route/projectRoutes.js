import express from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addMilestone
} from '../controller/projectController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply 'protect' to all routes in this file (must be logged in)
router.use(protect);

// Routes for '/' (e.g. /api/projects)
router
  .route('/')
  .get(getProjects) // Any logged-in user can view their projects
  .post(authorize('admin'), createProject); // Only Admin can create

// Routes for '/:id' (e.g. /api/projects/65a...)
router
  .route('/:id')
  .get(getProjectById) // Any logged-in user can view details (if authorized by controller logic)
  .put(authorize('admin'), updateProject) // Only Admin can update
  .delete(authorize('admin'), deleteProject); // Only Admin can delete

// Specific route for milestones
router
  .route('/:id/milestones')
  .post(authorize('admin'), addMilestone);

export default router;