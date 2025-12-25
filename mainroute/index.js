import express from 'express';

// Import all route files
import authRoutes from '../route/authRoutes.js';
import userRoutes from '../route/userRoutes.js';
import projectRoutes from '../route/projectRoutes.js';
import taskRoutes from '../route/taskRoutes.js';
import documentRoutes from '../route/documentRoutes.js';
import chatRoutes from '../route/chatRoutes.js';
import messageRoutes from '../route/messageRoutes.js';
import notificationRoutes from '../route/notificationRoutes.js';
import financeRoutes from '../route/financeRoutes.js';

// Import specialized portal routes
import adminRoutes from '../route/adminRoutes.js';
import clientPortalRoutes from '../route/clientPortalRoutes.js';
import teamMemberRoutes from '../route/teamMemberRoutes.js';

const router = express.Router();

// Mount routes to their specific paths
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/documents', documentRoutes);
router.use('/chats', chatRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/finance', financeRoutes);

// Portal-specific paths
router.use('/admin', adminRoutes);
router.use('/client-portal', clientPortalRoutes);
router.use('/team-portal', teamMemberRoutes);

export default router;