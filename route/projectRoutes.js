import express from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  addMilestone,
  addTeamMemberToProject
} from '../controller/projectController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../utils/fileUpload.js';

const router = express.Router();

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

router.route('/:id/milestones')
  .post(authorize('admin'), addMilestone);

router.route('/:id/team')
  .post(authorize('admin'), addTeamMemberToProject);

export default router;