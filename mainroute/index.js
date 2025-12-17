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
<<<<<<< HEAD
import teamMemberRoutes from '../route/teamMemberRoutes.js';
import clientPortalRoutes from '../route/clientPortalRoutes.js'; 
=======
>>>>>>> 19cc0d7e1a2f4d38ad1129efb7b0b10e0d44afa3

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/documents', documentRoutes);
router.use('/finance', financeRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
<<<<<<< HEAD
router.use('/users', userRoutes);
router.use('/team-portal', teamMemberRoutes);
router.use('/client-portal', clientPortalRoutes);
=======
router.use('/users', userRoutes); 
>>>>>>> 19cc0d7e1a2f4d38ad1129efb7b0b10e0d44afa3

export default router;