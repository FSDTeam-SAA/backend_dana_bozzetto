import User from '../model/User.js';
import generateToken from '../utils/generateToken.js';

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      password, 
      role, // 'client', 'team_member', 'admin'
      clientId, 
      employeeId, 
      address, 
      phoneNumber 
    } = req.body;

    // 1. Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // 2. Role-specific validation
    if (role === 'client' && !clientId) {
      return res.status(400).json({ message: 'Client ID is required for clients' });
    }
    if (role === 'team_member' && !employeeId) {
      return res.status(400).json({ message: 'Employee ID is required for team members' });
    }

    // 3. Create User
    const user = await User.create({
      name,
      email,
      password,
      role: role || 'client', // Default to client if not specified
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
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { emailOrId, password } = req.body; 

    // Allow login with Email OR ClientID OR EmployeeID
    // We search for a user where ANY of these fields match the input
    const user = await User.findOne({
      $or: [
        { email: emailOrId },
        { clientId: emailOrId },
        { employeeId: emailOrId }
      ]
    }).select('+password'); // Explicitly select password to compare

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
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