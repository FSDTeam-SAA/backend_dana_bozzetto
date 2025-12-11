import express from 'express';
import authRoutes from '../route/authRoutes.js';
import projectRoutes from '../route/projectRoutes.js';
import taskRoutes from '../route/taskRoutes.js';
import documentRoutes from '../route/documentRoutes.js';
import financeRoutes from '../route/financeRoutes.js';
import messageRoutes from '../route/messageRoutes.js';
import notificationRoutes from '../route/notificationRoutes.js';
import adminRoutes from '../route/adminRoutes.js';
import userRoutes from '../route/userRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/documents', documentRoutes);
router.use('/finance', financeRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes); 

export default router;