import User from '../model/User.js';
import generateToken, { generateRefreshToken } from '../utils/generateToken.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import sendEmail from '../utils/sendEmail.js';
import jwt from 'jsonwebtoken';

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

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'client',
      clientId,
      employeeId,
      address,
      phoneNumber,
      isVerified: false, 
      resetPasswordToken: otp,
      resetPasswordExpire: Date.now() + 10 * 60 * 1000 
    });

    if (user) {
      try {
        await sendEmail({
            email: user.email,
            subject: 'Verify Your Email',
            message: `Your Email Verification OTP is: ${otp}`,
            otp: otp
        });
        
        res.status(201).json({ 
            message: 'User registered successfully. OTP sent to email. Please verify to login.',
            email: user.email 
        });
      } catch (err) {
        console.error("Email send failed:", err);
        return res.status(201).json({ message: 'User created but failed to send OTP email. Please contact support.' });
      }
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @route   POST /api/auth/verify-email
export const verifyEmailOtp = async (req, res) => {
    const { email, otp } = req.body;

    try {
        const user = await User.findOne({
            email,
            resetPasswordToken: otp,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or Expired OTP' });
        }

        user.isVerified = true;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();

        const accessToken = generateToken(user._id);
        const refreshToken = generateRefreshToken(user._id);

        res.cookie('jwt', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'strict', 
            maxAge: 30 * 24 * 60 * 60 * 1000, 
        });

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            token: accessToken,
        });

    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const loginUser = async (req, res) => {
  try {
    const { emailOrId, password, rememberMe } = req.body; 

    const user = await User.findOne({
      $or: [
        { email: emailOrId },
        { clientId: emailOrId },
        { employeeId: emailOrId }
      ]
    }).select('+password');

    if (user && (await user.matchPassword(password))) {
        if (user.isVerified === false) {
            return res.status(401).json({ message: 'Email not verified. Please verify your account.' });
        }

        const accessToken = generateToken(user._id);

        const refreshToken = generateRefreshToken(user._id, rememberMe);

        res.cookie('jwt', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV !== 'development',
            sameSite: 'strict',
            maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, 
        });

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            token: accessToken, 
        });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Refresh Access Token
// @route   POST /api/auth/refresh
// @access  Public (Uses Cookie)
export const refreshToken = async (req, res) => {
    const cookies = req.cookies;

    if (!cookies?.jwt) return res.status(401).json({ message: 'Unauthorized, no refresh token' });

    const refreshToken = cookies.jwt;

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decoded.userId);
        if (!user) return res.status(401).json({ message: 'User not found' });

        const accessToken = generateToken(user._id);

        res.json({ token: accessToken });
    } catch (error) {
        return res.status(403).json({ message: 'Forbidden, invalid refresh token' });
    }
};

export const logoutUser = (req, res) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) return res.sendStatus(204); 

    res.clearCookie('jwt', {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV !== 'development',
    });
    
    res.json({ message: 'Logged out successfully' });
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

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.companyName = req.body.companyName || user.companyName;
      user.address = req.body.address || user.address;
      user.phoneNumber = req.body.phoneNumber || user.phoneNumber;
 
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


export const forgotPassword = async (req, res) => {
  const { contact } = req.body; 

  try {
    const isEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(contact);
    
    if (!isEmail) {
        return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    const user = await User.findOne({ email: contact });

    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordToken = otp;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; 

    await user.save({ validateBeforeSave: false });

    try {
        await sendEmail({
            email: user.email,
            subject: 'Reset Password OTP',
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

export const verifyOtp = async (req, res) => {
    const { contact, otp } = req.body; 

    try {
        const user = await User.findOne({
            email: contact,
            resetPasswordToken: otp,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or Expired OTP' });
        }

        res.status(200).json({ message: 'OTP Verified', userId: user._id });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

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
        
        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();

        res.status(200).json({ message: 'Password updated successfully. You can now login.' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};