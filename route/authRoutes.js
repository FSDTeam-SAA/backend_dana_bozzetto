import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getMe,
  updateProfile,
  changePassword
} from '../controller/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, changePassword);

export default router;