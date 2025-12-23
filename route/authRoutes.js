import express from 'express';
import { 
  registerUser, 
  verifyEmailOtp, // New import
  loginUser, 
  getMe,
  updateProfile,
  changePassword,
  forgotPassword, // New import
  verifyOtp,      // New import
  resetPassword   // New import
} from '../controller/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../utils/fileUpload.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-email', verifyEmailOtp);
router.post('/login', loginUser);


router.post('/forgot-password', forgotPassword); 
router.post('/verify-otp', verifyOtp);         
router.put('/reset-password', resetPassword);    

router.get('/me', protect, getMe);
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.put('/password', protect, changePassword);

export default router;