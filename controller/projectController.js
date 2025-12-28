import { Project } from '../model/Project.js';
import User from '../model/User.js';
import { Document } from '../model/Document.js';
import { Task } from '../model/Task.js';
import { Finance } from '../model/Finance.js';
import { Notification } from '../model/Notification.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';
import { Chat } from '../model/Chat.js';

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

    const defaultMilestones = [
      { name: 'Pre-Design', status: 'Pending', isEnabled: true },
      { name: 'Schematic Design', status: 'Pending', isEnabled: true },
      { name: 'Design Development', status: 'Pending', isEnabled: true },
      { name: 'Construction Documents', status: 'Pending', isEnabled: true }
    ];

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
      milestones: defaultMilestones
    });

    const chatUsers = [req.user._id, clientId];
   
    if (formattedTeam.length > 0) {
        formattedTeam.forEach(member => {
            if (!chatUsers.includes(member.user)) {
                chatUsers.push(member.user);
            }
        });
    }

    await Chat.create({
        chatName: `Project: ${name}`,
        isGroupChat: true,
        users: chatUsers,
        groupAdmin: req.user._id,
        project: project._id
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
          type: 'Other', 
          status: 'Approved'
        });
      });
      await Promise.all(uploadPromises);
    }

    if (formattedTeam.length > 0) {
        const notificationPromises = formattedTeam.map(member => 
            Notification.create({
                recipient: member.user,
                sender: req.user._id,
                type: 'Message', 
                message: `You have been assigned to a new project: ${name}`,
                relatedId: project._id,
                onModel: 'Project'
            })
        );
        await Promise.all(notificationPromises);
    }

    res.status(201).json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getProjects = async (req, res) => {
    try {
      let query = {};
      if (req.user.role === 'client') {
        query = { client: req.user._id };
      } else if (req.user.role === 'team_member') {
        query = { 'teamMembers.user': req.user._id };
      }
      // Admin filter
      if (req.user.role === 'admin' && req.query.clientId) {
        query.client = req.query.clientId;
      }

      const projects = await Project.find(query)
        .populate('client', 'name email avatar')
        .populate('teamMembers.user', 'name role avatar')
        .sort({ createdAt: -1 });

      res.json(projects);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
};

export const getProjectById = async (req, res) => {
    try {
      const project = await Project.findById(req.params.id)
        .populate('client', 'name email phoneNumber address avatar')
        .populate('teamMembers.user', 'name email role avatar employeeId phoneNumber');
      
      if (!project) return res.status(404).json({ message: 'Project not found' });

      if (req.user.role === 'client' && project.client._id.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Not authorized' });
      }
      if (req.user.role === 'team_member') {
          const isMember = project.teamMembers.some(m => m.user._id.toString() === req.user._id.toString());
          if (!isMember) return res.status(403).json({ message: 'Not authorized' });
      }

      const tasks = await Task.find({ project: project._id })
        .populate('assignedTo', 'name avatar')
        .sort({ endDate: 1 });

      let docQuery = { project: project._id };
      if (req.user.role === 'client') {
           docQuery.type = 'Deliverable';
      }

      const documents = await Document.find(docQuery)
        .populate('uploadedBy', 'name role')
        .sort({ createdAt: -1 });

      let financeStats = { totalPaid: 0, totalUnpaid: 0 };
      if (req.user.role !== 'team_member') {
          const financeAgg = await Finance.aggregate([
            { $match: { project: project._id, type: 'Invoice' } },
            { 
              $group: {
                _id: null,
                totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$totalAmount', 0] } },
                totalUnpaid: { $sum: { $cond: [{ $ne: ['$status', 'Paid'] }, '$totalAmount', 0] } }
              }
            }
          ]);
          if (financeAgg.length > 0) financeStats = financeAgg[0];
      }

      res.json({
        ...project.toObject(),
        tasks,
        documents,
        financials: {
          totalBudget: project.budget,
          totalPaid: financeStats.totalPaid,
          totalUnpaid: financeStats.totalUnpaid
        }
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
};

export const updateProject = async (req, res) => {
    try {
      const project = await Project.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
};

export const addMilestone = async (req, res) => {
    try {
      const project = await Project.findById(req.params.id);
      if (!project) return res.status(404).json({ message: 'Project not found' });
      
      project.milestones.push({ 
        name: req.body.name, 
        status: 'Pending',
        isEnabled: true 
      });
      
      await project.save();
      res.json(project);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

export const deleteProject = async (req, res) => {
    try {
      await Project.findByIdAndDelete(req.params.id);
      res.json({ message: 'Project removed' });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
};

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
 
    const chat = await Chat.findOne({ project: project._id, isGroupChat: true });
    if (chat) {
        if (!chat.users.includes(userId)) {
            chat.users.push(userId);
            await chat.save();
        }
    }

    await Notification.create({
        recipient: userId,
        sender: req.user._id,
        type: 'Message',
        message: `You have been added to the project team: ${project.name}`,
        relatedId: project._id,
        onModel: 'Project'
    });

    await project.populate('teamMembers.user', 'name role avatar employeeId');

    res.json(project.teamMembers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const uploadMilestoneDocument = async (req, res) => {
  try {
    const { id, milestoneId } = req.params;
    
    const project = await Project.findById(id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const milestone = project.milestones.id(milestoneId);
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });

    if (!req.file) return res.status(400).json({ message: 'File is required' });
    
    const result = await uploadToCloudinary(req.file.buffer, 'architectural-projects/milestones');

    const document = await Document.create({
      name: req.body.name || req.file.originalname,
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
      type: 'Deliverable', 
      status: 'Review' 
    });

    milestone.status = 'Completed';

    const total = project.milestones.length;
    const completed = project.milestones.filter(m => m.status === 'Completed').length;
    project.overallProgress = Math.round((completed / total) * 100);

    await project.save();

    await Notification.create({
        recipient: project.client,
        sender: req.user._id,
        type: 'Document Uploaded',
        message: `A new milestone deliverable "${document.name}" is available for your review.`,
        relatedId: document._id,
        onModel: 'Document'
    });

    res.json({ message: 'Milestone document uploaded', document, project });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};