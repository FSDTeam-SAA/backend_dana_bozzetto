import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getMe 
} from '../controller/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected Routes
// This route requires a valid token (Login) to access
router.get('/me', protect, getMe);

export default router;