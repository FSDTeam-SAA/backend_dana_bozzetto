import User from '../model/User.js';
import bcrypt from 'bcryptjs';

// @desc    Get User Settings
// @route   GET /api/settings
export const getUserSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('settings');
    res.json(user.settings);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update User Settings (Notifications & Language)
// @route   PUT /api/settings
export const updateUserSettings = async (req, res) => {
  try {
    const { notifications, language } = req.body;
    const user = await User.findById(req.user._id);

    if (notifications) {
      user.settings.notifications = { 
        ...user.settings.notifications, 
        ...notifications 
      };
    }

    if (language) {
      user.settings.language = language;
    }

    await user.save();
    res.json({ message: 'Settings updated', settings: user.settings });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Change Password (Logged In)
// @route   PUT /api/settings/password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    // 1. Verify Current Password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect current password' });
    }

    // 2. Set New Password (User model pre-save hook will hash it)
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};