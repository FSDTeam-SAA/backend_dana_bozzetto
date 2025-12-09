import express from 'express';
import authRoutes from '../route/authRoutes.js';
import projectRoutes from '../route/projectRoutes.js'; 

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);

export default router;