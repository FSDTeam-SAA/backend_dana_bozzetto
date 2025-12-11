import User from '../model/User.js';
import { Project } from '../model/Project.js';
import { Finance } from '../model/Finance.js';
import { Task } from '../model/Task.js'; // Import Task model for team stats
import { uploadToCloudinary } from '../utils/cloudinary.js';

// @desc    Add a new Team Member (Admin only)
export const addTeamMember = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      employeeId, 
      phoneNumber, 
      address 
    } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    let avatarData = { public_id: '', url: '' };
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'architectural-portal/avatars');
      avatarData = {
        public_id: result.public_id,
        url: result.secure_url
      };
    }

    const tempPassword = Math.random().toString(36).slice(-8);

    const user = await User.create({
      name,
      email,
      password: tempPassword,
      role: 'team_member',
      employeeId,
      phoneNumber,
      address,
      avatar: avatarData.url || 'https://via.placeholder.com/150'
    });

    res.status(201).json({
      message: 'Team Member created successfully',
      user,
      tempPassword
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Add a new Client (Admin only)
export const addClient = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      clientId, 
      companyName, 
      phoneNumber, 
      address 
    } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    let avatarData = { public_id: '', url: '' };
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'architectural-portal/avatars');
      avatarData = { public_id: result.public_id, url: result.secure_url };
    }

    const tempPassword = Math.random().toString(36).slice(-8);

    const user = await User.create({
      name,
      email,
      password: tempPassword,
      role: 'client',
      clientId,
      companyName,
      phoneNumber,
      address,
      avatar: avatarData.url || 'https://via.placeholder.com/150'
    });

    res.status(201).json({
      message: 'Client created successfully',
      user,
      tempPassword
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all users by role with Project Counts (For Lists)
export const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.query; 
    
    const users = await User.aggregate([
      { 
        $match: role ? { role: role } : {} 
      },
      {
        $lookup: {
          from: 'projects',
          localField: '_id',
          foreignField: role === 'client' ? 'client' : 'teamMembers.user',
          as: 'projects'
        }
      },
      {
        $addFields: {
          totalProjects: { $size: '$projects' }
        }
      },
      {
        $project: {
          projects: 0, 
          password: 0  
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get Full Client Dashboard Profile
export const getClientDashboard = async (req, res) => {
  try {
    const clientId = req.params.id;

    const client = await User.findById(clientId).select('-password');
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }

    const projects = await Project.find({ client: clientId })
      .select('name status overallProgress milestones');

    const projectStats = projects.map(p => ({
      _id: p._id,
      name: p.name,
      status: p.status,
      progress: p.overallProgress || 0 
    }));

    const finances = await Finance.aggregate([
      { $match: { client: client._id, type: 'Invoice' } },
      {
        $group: {
          _id: null,
          totalPaid: { 
            $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$totalAmount', 0] } 
          },
          totalUnpaid: { 
            $sum: { $cond: [{ $ne: ['$status', 'Paid'] }, '$totalAmount', 0] } 
          }
        }
      }
    ]);

    const financeStats = finances.length > 0 ? finances[0] : { totalPaid: 0, totalUnpaid: 0 };

    res.json({
      client,
      projectStats,
      financeStats: {
        activeProjects: projects.filter(p => p.status === 'Active').length,
        ...financeStats
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get Full Team Member Dashboard (NEW FEATURE)
// @route   GET /api/users/team-member/:id/dashboard
// @access  Private
export const getTeamMemberDashboard = async (req, res) => {
  try {
    const userId = req.params.id;

    // 1. Fetch User Info
    const user = await User.findById(userId).select('-password');
    if (!user || user.role !== 'team_member') {
      return res.status(404).json({ message: 'Team member not found' });
    }

    // 2. Fetch Projects assigned to this user
    // We also select 'teamMembers' so we can show their specific role (e.g. "Designer")
    const projects = await Project.find({ 'teamMembers.user': userId })
      .select('name status startDate endDate teamMembers overallProgress');

    // Format projects to show the specific role this user has in that project
    const assignedProjects = projects.map(p => {
      const memberInfo = p.teamMembers.find(m => m.user.toString() === userId.toString());
      return {
        _id: p._id,
        name: p.name,
        status: p.status,
        projectRole: memberInfo ? memberInfo.role : 'Contributor',
        progress: p.overallProgress || 0,
        startDate: p.startDate,
        endDate: p.endDate
      };
    });

    // 3. Fetch Task Statistics
    const tasks = await Task.find({ assignedTo: userId });
    
    const taskStats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'Done').length,
      pending: tasks.filter(t => t.status !== 'Done').length,
      highPriority: tasks.filter(t => t.priority === 'High' && t.status !== 'Done').length
    };

    res.json({
      user,
      assignedProjects,
      taskStats
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete a user
export const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};