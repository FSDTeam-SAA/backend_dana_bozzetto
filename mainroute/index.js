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
import teamMemberRoutes from '../route/teamMemberRoutes.js';
import clientPortalRoutes from '../route/clientPortalRoutes.js'; 
import chatRoutes from '../route/chatRoutes.js'; // Added this NEW route

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/documents', documentRoutes);
router.use('/finance', financeRoutes);
router.use('/messages', messageRoutes); // Handles sending/receiving messages
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/users', userRoutes);
router.use('/team-portal', teamMemberRoutes);
router.use('/client-portal', clientPortalRoutes);
router.use('/chats', chatRoutes); // Handles Sidebar/Room creation

export default router;