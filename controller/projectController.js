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
      teamMembers 
    } = req.body;

    const clientUser = await User.findById(clientId);
    if (!clientUser || clientUser.role !== 'client') {
      return res.status(400).json({ message: 'Invalid Client ID provided' });
    }

    // Process Team Members (String -> Object Array)
    let formattedTeam = [];
    if (teamMembers) {
      const parsedMembers = typeof teamMembers === 'string' ? JSON.parse(teamMembers) : teamMembers;
      if (Array.isArray(parsedMembers)) {
        formattedTeam = parsedMembers.map(member => {
          if (typeof member === 'string') return { user: member, role: 'Contributor' };
          return member;
        });
      }
    }

    let coverImageData = { public_id: '', url: '' };
    if (req.files && req.files['coverImage']) {
      const file = req.files['coverImage'][0];
      const result = await uploadToCloudinary(file.buffer, 'architectural-projects/covers');
      coverImageData = { public_id: result.public_id, url: result.secure_url };
    }

    const project = await Project.create({
      projectNo,
      name,
      description,
      client: clientId,
      budget,
      startDate,
      endDate,
      status: status || 'Active',
      teamMembers: formattedTeam,
      coverImage: coverImageData,
      milestones: [{ name: 'Pre-Design', status: 'Pending', isEnabled: true }]
    });

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
// @route   GET /api/projects
// @access  Private
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
// @route   GET /api/projects/:id
// @access  Private
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
// @route   PUT /api/projects/:id
// @access  Private/Admin
export const updateProject = async (req, res) => {
    try {
      const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Add a Milestone (Manual)
// @route   POST /api/projects/:id/milestones
// @access  Private/Admin
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
// @route   DELETE /api/projects/:id
// @access  Private/Admin
export const deleteProject = async (req, res) => {
    try {
      await Project.findByIdAndDelete(req.params.id);
      res.json({ message: 'Project removed' });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Add a Team Member to an existing Project
// @route   POST /api/projects/:id/team
// @access  Private/Admin
export const addTeamMemberToProject = async (req, res) => {
  try {
    const { userId, role } = req.body;
    const project = await Project.findById(req.params.id);

    if (!project) return res.status(404).json({ message: 'Project not found' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isAlreadyMember = project.teamMembers.some(
      (member) => member.user.toString() === userId
    );

    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already assigned to this project' });
    }

    project.teamMembers.push({ user: userId, role: role || 'Contributor' });
    await project.save();
    await project.populate('teamMembers.user', 'name role avatar');

    res.json(project.teamMembers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Upload Final Milestone Document (Admin Only)
// @route   POST /api/projects/:id/milestones/:milestoneId/upload
// @access  Private/Admin
export const uploadMilestoneDocument = async (req, res) => {
  try {
    const { id, milestoneId } = req.params;
    
    // 1. Find Project and Milestone
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const milestone = project.milestones.id(milestoneId);
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    // 2. Upload File
    if (!req.file) return res.status(400).json({ message: 'File is required' });
    
    const result = await uploadToCloudinary(req.file.buffer, 'architectural-projects/milestones');

    // 3. Create Document Record
    // Mark as "Approved" immediately since Admin is uploading it for the Client
    const document = await Document.create({
      name: req.body.name || file.originalname,
      project: project._id,
      milestoneId: milestone._id,
      uploadedBy: req.user._id,
      file: {
        public_id: result.public_id,
        url: result.secure_url,
        mimeType: req.file.mimetype,
        size: req.file.size,
        format: result.format
      },
      type: 'Deliverable', // Special type for final milestone docs
      status: 'Review' // Client needs to review it
    });

    // 4. Update Milestone Status
    // Since Admin uploaded the final doc, we mark the milestone as Completed (or Active for Review)
    milestone.status = 'Completed';
    
    // Also update overall project progress? (Simple logic: % of completed milestones)
    const total = project.milestones.length;
    const completed = project.milestones.filter(m => m.status === 'Completed').length;
    project.overallProgress = Math.round((completed / total) * 100);

    await project.save();

    res.json({ message: 'Milestone document uploaded', document, project });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};