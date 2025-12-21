import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getMe,
  updateProfile,
  changePassword
} from '../controller/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../utils/fileUpload.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/me', protect, getMe);

// Allow Avatar upload on profile update
router.put('/profile', protect, upload.single('avatar'), updateProfile);

router.put('/password', protect, changePassword);

export default router;