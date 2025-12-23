import User from '../model/User.js';
import generateToken from '../utils/generateToken.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import sendEmail from '../utils/sendEmail.js';
import crypto from 'crypto';

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

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            token: generateToken(user._id, false),
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

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
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