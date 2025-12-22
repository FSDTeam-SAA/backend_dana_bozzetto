import User from '../model/User.js';
import generateToken from '../utils/generateToken.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import sendEmail from '../utils/sendEmail.js';
import crypto from 'crypto';

// @desc    Register a new user
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role, clientId, employeeId, address, phoneNumber } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    if (role === 'client' && !clientId) {
      return res.status(400).json({ message: 'Client ID is required for clients' });
    }
    if (role === 'team_member' && !employeeId) {
      return res.status(400).json({ message: 'Employee ID is required for team members' });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'client',
      clientId,
      employeeId,
      address,
      phoneNumber
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id, false), // Default: No remember me on register
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Auth user & get token (Login)
export const loginUser = async (req, res) => {
  try {
    const { emailOrId, password, rememberMe } = req.body; 

    // Allow login with Email, ClientID, or EmployeeID
    const user = await User.findOne({
      $or: [
        { email: emailOrId },
        { clientId: emailOrId },
        { employeeId: emailOrId }
      ]
    }).select('+password');

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        // Pass rememberMe boolean (true = 30 days, false = 1 day)
        token: generateToken(user._id, rememberMe),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.companyName = req.body.companyName || user.companyName;
      user.address = req.body.address || user.address;
      user.phoneNumber = req.body.phoneNumber || user.phoneNumber;
 
      // Handle Avatar Upload
      if (req.file) {
        const result = await uploadToCloudinary(req.file.buffer, 'architectural-portal/avatars');
        user.avatar = {
             public_id: result.public_id,
             url: result.secure_url
        };
      }

      const updatedUser = await user.save();

      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        companyName: updatedUser.companyName,
        address: updatedUser.address,
        phoneNumber: updatedUser.phoneNumber,
        avatar: updatedUser.avatar,
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Change Password (LoggedIn)
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    if (user && (await user.matchPassword(oldPassword))) {
      user.password = newPassword;
      await user.save();
      res.json({ message: 'Password updated successfully' });
    } else {
      res.status(401).json({ message: 'Invalid old password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// =========================================================================
// FORGOT PASSWORD FLOW (OTP - EMAIL ONLY)
// =========================================================================

// @desc    Forgot Password - Send OTP via Email
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  const { contact } = req.body; // Expecting Email

  try {
    // Check if input looks like an email
    const isEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(contact);
    
    if (!isEmail) {
        return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const user = await User.findOne({ email: contact });

    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in DB
    user.resetPasswordToken = otp;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 Minutes

    await user.save({ validateBeforeSave: false });

    // Send via Email (Uses Nodemailer)
    try {
        await sendEmail({
            email: user.email,
            subject: 'Your Password Reset Code',
            message: `Your OTP is: ${otp}`,
            otp: otp
        });
        res.status(200).json({ message: 'OTP sent to email', method: 'email' });
    } catch (err) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });
        return res.status(500).json({ message: 'Email could not be sent' });
    }

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOtp = async (req, res) => {
    const { contact, otp } = req.body; // contact represents email

    try {
        // Enforce email check
        const isEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(contact);
        if (!isEmail) {
             return res.status(400).json({ message: 'Invalid email format' });
        }

        const user = await User.findOne({
            email: contact,
            resetPasswordToken: otp,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or Expired OTP' });
        }

        // OTP is correct
        res.status(200).json({ message: 'OTP Verified', userId: user._id });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Reset Password
// @route   PUT /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
    const { userId, newPassword, confirmPassword } = req.body;

    try {
        if (newPassword !== confirmPassword) {
             return res.status(400).json({ message: "Passwords do not match" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Set new password
        user.password = newPassword;
        
        // Clear OTP fields
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        res.status(200).json({ message: 'Password updated successfully. You can now login.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};