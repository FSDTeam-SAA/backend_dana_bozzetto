import express from 'express';
import { 
  registerUser, 
  verifyEmailOtp, 
  loginUser, 
  refreshToken, 
  logoutUser,    
  getMe,
  updateProfile,
  changePassword,
  forgotPassword, 
  verifyOtp,      
  resetPassword   
} from '../controller/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import upload from '../utils/fileUpload.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/verify-email', verifyEmailOtp); 
router.post('/login', loginUser);

router.post('/refresh', refreshToken); 
router.post('/logout', logoutUser);

router.post('/forgot-password', forgotPassword); 
router.post('/verify-otp', verifyOtp);           
router.put('/reset-password', resetPassword);    

router.get('/me', protect, getMe);
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.put('/password', protect, changePassword);

export default router;