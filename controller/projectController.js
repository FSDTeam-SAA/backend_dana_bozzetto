import { Project } from '../model/Project.js';
import User from '../model/User.js';
import { Document } from '../model/Document.js';
import { Task } from '../model/Task.js';
import { Finance } from '../model/Finance.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private/Admin
export const createProject = async (req, res) => {
  try {
    const {
      projectNo,
      name,
      description,
      clientId,
      budget,
      startDate,
      endDate,
      status,
      teamMembers // Received as stringified JSON: '["ID1", "ID2"]'
    } = req.body;

    // 1. Verify Client
    const clientUser = await User.findById(clientId);
    if (!clientUser || clientUser.role !== 'client') {
      return res.status(400).json({ message: 'Invalid Client ID provided' });
    }

    // 2. Process Team Members
    // Fix: Convert ["ID1", "ID2"] -> [{ user: "ID1" }, { user: "ID2" }]
    let formattedTeam = [];
    if (teamMembers) {
      const parsedMembers = typeof teamMembers === 'string' ? JSON.parse(teamMembers) : teamMembers;
      
      if (Array.isArray(parsedMembers)) {
        formattedTeam = parsedMembers.map(member => {
          // If the item is just an ID string, wrap it in an object
          if (typeof member === 'string') {
            return { user: member, role: 'Contributor' };
          }
          return member; // Already an object
        });
      }
    }

    // 3. Handle Cover Image Upload
    let coverImageData = { public_id: '', url: '' };
    if (req.files && req.files['coverImage']) {
      const file = req.files['coverImage'][0];
      const result = await uploadToCloudinary(file.buffer, 'architectural-projects/covers');
      coverImageData = { public_id: result.public_id, url: result.secure_url };
    }

    // 4. Create Project
    const project = await Project.create({
      projectNo,
      name,
      description,
      client: clientId,
      budget,
      startDate,
      endDate,
      status: status || 'Active',
      teamMembers: formattedTeam, // Use the formatted array
      coverImage: coverImageData,
      milestones: [{ name: 'Pre-Design', status: 'Pending', isEnabled: true }]
    });

    // 5. Handle "Initial Documents" Upload
    if (req.files && req.files['documents']) {
      const initialMilestone = project.milestones[0];
      const uploadPromises = req.files['documents'].map(async (file) => {
        const result = await uploadToCloudinary(file.buffer, 'architectural-projects/documents');
        return Document.create({
          name: file.originalname,
          project: project._id,
          milestoneId: initialMilestone._id,
          uploadedBy: req.user._id,
          file: {
            public_id: result.public_id,
            url: result.secure_url,
            mimeType: file.mimetype,
            size: file.size,
            format: result.format
          },
          type: result.format === 'pdf' ? 'PDF' : 'Image',
          status: 'Pending'
        });
      });
      await Promise.all(uploadPromises);
    }

    res.status(201).json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all projects
export const getProjects = async (req, res) => {
    try {
      let query = {};
      if (req.user.role === 'client') {
        query = { client: req.user._id };
      } else if (req.user.role === 'team_member') {
        query = { 'teamMembers.user': req.user._id };
      }
      if (req.user.role === 'admin' && req.query.clientId) {
        query.client = req.query.clientId;
      }

      const projects = await Project.find(query)
        .populate('client', 'name email avatar')
        .populate('teamMembers.user', 'name role avatar');
      res.json(projects);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Full Project Details
export const getProjectById = async (req, res) => {
    try {
      const project = await Project.findById(req.params.id)
        .populate('client', 'name email phoneNumber address avatar')
        .populate('teamMembers.user', 'name email role avatar employeeId');
      
      if (!project) return res.status(404).json({ message: 'Project not found' });
      
      if (req.user.role === 'client' && project.client._id.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized' });
      }

      const tasks = await Task.find({ project: project._id })
        .populate('assignedTo', 'name avatar')
        .sort({ endDate: 1 });

      const documents = await Document.find({ project: project._id })
        .populate('uploadedBy', 'name role')
        .sort({ createdAt: -1 });

      const financeStats = await Finance.aggregate([
        { $match: { project: project._id, type: 'Invoice' } },
        { 
          $group: {
            _id: null,
            totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$totalAmount', 0] } },
            totalUnpaid: { $sum: { $cond: [{ $ne: ['$status', 'Paid'] }, '$totalAmount', 0] } }
          }
        }
      ]);

      const financials = financeStats.length > 0 ? financeStats[0] : { totalPaid: 0, totalUnpaid: 0 };

      res.json({
        ...project.toObject(),
        tasks,
        documents,
        financials: {
          totalBudget: project.budget,
          totalPaid: financials.totalPaid,
          totalUnpaid: financials.totalUnpaid
        }
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Update project details
export const updateProject = async (req, res) => {
    try {
      const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Add a Milestone
export const addMilestone = async (req, res) => {
    try {
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ message: 'Project not found' });
      
      project.milestones.push({ name: req.body.name, status: 'Pending' });
      await project.save();
      
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a project
export const deleteProject = async (req, res) => {
    try {
      await Project.findByIdAndDelete(req.params.id);
      res.json({ message: 'Project removed' });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Add a Team Member to an existing Project
export const addTeamMemberToProject = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isAlreadyMember = project.teamMembers.some(
      (member) => member.user.toString() === userId
    );

    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already assigned to this project' });
    }

    project.teamMembers.push({ 
      user: userId, 
      role: role || 'Contributor' 
    });

    await project.save();
    await project.populate('teamMembers.user', 'name role avatar');

    res.json(project.teamMembers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};