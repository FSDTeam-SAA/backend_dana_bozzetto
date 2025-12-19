import express from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addMilestone,
  addTeamMemberToProject,
  uploadMilestoneDocument // Import the new function
} from '../controller/projectController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../utils/fileUpload.js';

const router = express.Router();

// All routes require login
router.use(protect);

router.route('/')
  .get(getProjects)
  .post(
    authorize('admin'),
    upload.fields([
      { name: 'coverImage', maxCount: 1 },
      { name: 'documents', maxCount: 10 }
    ]),
    createProject
  );

router.route('/:id')
  .get(getProjectById)
  .put(authorize('admin'), updateProject)
  .delete(authorize('admin'), deleteProject);

// Route to add a milestone manually
router.route('/:id/milestones')
  .post(authorize('admin'), addMilestone);

// Route to upload Final Milestone Document (Completes the milestone)
router.route('/:id/milestones/:milestoneId/upload')
  .post(
    authorize('admin'),
    upload.single('document'), // Field name must be 'document'
    uploadMilestoneDocument
  );

// Route to add a team member to an existing project
router.route('/:id/team')
  .post(authorize('admin'), addTeamMemberToProject);

export default router;