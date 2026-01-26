import { Project } from '../model/Project.js';
import { Task } from '../model/Task.js';
import { Document } from '../model/Document.js';
import { Notification } from '../model/Notification.js';
import { Chat } from '../model/Chat.js'; 
import { Message } from '../model/Message.js'; 

// @desc    Get Team Member Homepage Data (Dashboard)
// @route   GET /api/team-portal/dashboard
export const getMemberDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayTasks = await Task.find({
      assignedTo: userId,
      $or: [
        { endDate: { $gte: today, $lt: tomorrow } }, 
        { status: 'In Progress' }
      ]
    }).populate('project', 'name').limit(5);

    const totalActiveTasks = await Task.countDocuments({
      assignedTo: userId,
      status: 'In Progress'
    });

    const totalPendingTasks = await Task.countDocuments({
      assignedTo: userId,
      status: 'Pending'
    });

    const projects = await Project.find({ 'teamMembers.user': userId })
      .populate('client', 'name')
      .populate('teamMembers.user', 'avatar')
      .sort({ endDate: 1 });

    const assignedProjects = projects.map(project => {
      const totalMilestones = project.milestones.length;
      const completedMilestones = project.milestones.filter(m => m.status === 'Completed').length;
      
      let currentMilestoneIndex = completedMilestones + 1;
      if (currentMilestoneIndex > totalMilestones) currentMilestoneIndex = totalMilestones;

      return {
        _id: project._id,
        name: project.name,
        clientName: project.client ? project.client.name : 'Unknown',
        status: project.status,
        deadline: project.endDate,
        coverImage: project.coverImage?.url || '',
        milestoneProgress: `${currentMilestoneIndex}/${totalMilestones}`, 
        overallProgress: project.overallProgress,
        teamAvatars: project.teamMembers.map(tm => tm.user?.avatar?.url).filter(Boolean).slice(0, 3) 
      };
    });

    const userChats = await Chat.find({ users: { $elemMatch: { $eq: userId } } })
      .select('_id')
      .lean();
    
    const chatIds = userChats.map(c => c._id);

    const recentMessages = await Message.find({ 
       chat: { $in: chatIds },
       sender: { $ne: userId } 
    })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('sender', 'name avatar');

    const formattedMessages = recentMessages.map(msg => ({
        type: 'message',
        text: `Message from ${msg.sender ? msg.sender.name : 'User'}`,
        subText: msg.content ? (msg.content.substring(0, 30) + (msg.content.length > 30 ? '...' : '')) : 'Sent an attachment',
        time: msg.createdAt,
        id: msg.chat,
        senderAvatar: msg.sender?.avatar?.url
    }));

    // Quick Actions Counts
    const projectIds = projects.map(p => p._id);
    const documentsCount = await Document.countDocuments({ project: { $in: projectIds } });

    const pendingTaskApprovals = await Task.countDocuments({ assignedTo: userId, status: 'Waiting for Approval' });
    const pendingDocApprovals = await Document.countDocuments({ uploadedBy: userId, status: 'Review' });
    
    const rejectedTasks = await Task.countDocuments({ assignedTo: userId, status: 'In Progress', adminFeedback: { $exists: true, $ne: "" } });
    const rejectedDocs = await Document.countDocuments({ uploadedBy: userId, status: 'Revision Requested' });

    res.json({
      userName: req.user.name,
      todayTasks,
      stats: {
        activeTasks: totalActiveTasks,
        pendingTasks: totalPendingTasks
      },
      quickActions: {
        documents: documentsCount,
        approvals: pendingTaskApprovals + pendingDocApprovals,
        reviews: rejectedTasks + rejectedDocs
      },
      assignedProjects,
      recentMessages: formattedMessages
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get Tasks for Calendar View
export const getMemberCalendar = async (req, res) => {
  try {
    const userId = req.user._id;
    const { month, year } = req.query;

    let dateFilter = {};
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      
      dateFilter = {
        $or: [
            { startDate: { $gte: startDate, $lte: endDate } },
            { endDate: { $gte: startDate, $lte: endDate } }
        ]
      };
    }

    const tasks = await Task.find({
      assignedTo: userId,
      ...dateFilter
    }).populate('project', 'name').sort({ endDate: 1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Global Search (Projects, Documents & Tasks)
// @route   GET /api/team-portal/search?q=...
export const searchGlobal = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user._id;

    if (!q) return res.json({ projects: [], documents: [], tasks: [] });

    const regex = new RegExp(q, 'i');

    // 1. Projects
    const projects = await Project.find({
      'teamMembers.user': userId,
      name: regex
    }).select('name status coverImage');

    // 2. Documents
    const userProjects = await Project.find({ 'teamMembers.user': userId }).select('_id');
    const projectIds = userProjects.map(p => p._id);
    
    const documents = await Document.find({
      project: { $in: projectIds },
      name: regex
    }).select('name type file.url');

    // 3. Tasks (ADDED THIS NEW FEATURE)
    const tasks = await Task.find({
      assignedTo: userId,
      name: regex
    }).select('name status endDate project')
      .populate('project', 'name');

    res.json({ 
        projects: projects.map(p => ({
            _id: p._id,
            name: p.name,
            status: p.status,
            image: p.coverImage?.url
        })), 
        documents,
        tasks 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update Task Status
export const updateMemberTaskStatus = async (req, res) => {
  try {
    const { status } = req.body; 
    const taskId = req.params.id;
    const userId = req.user._id;

    const task = await Task.findOne({ _id: taskId, assignedTo: userId });

    if (!task) {
      return res.status(404).json({ message: 'Task not found or not assigned to you' });
    }

    if (status === 'Dispute') {
       task.status = 'On Hold'; 
    } else if (status === 'Done') {
        task.status = 'Completed'; 
    } else {
       task.status = status;
    }
    
    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// --- NEW QUICK ACTION ENDPOINTS ---

// @desc    Get All Documents (Supports ?milestone=...)
// @route   GET /api/team-portal/documents
export const getAllTeamDocuments = async (req, res) => {
    try {
        const userId = req.user._id;
        const { milestone } = req.query; 

        // 1. Find projects user is assigned to
        const userProjects = await Project.find({ 'teamMembers.user': userId }).select('_id milestones');
        const projectIds = userProjects.map(p => p._id);

        // 2. Build Query
        let query = { project: { $in: projectIds } };

        // 3. Apply Milestone Filter
        if (milestone && milestone !== 'All') {
            let targetMilestoneIds = [];
            userProjects.forEach(p => {
                const found = p.milestones.find(m => m.name === milestone);
                if (found) targetMilestoneIds.push(found._id);
            });
            query.milestoneId = { $in: targetMilestoneIds };
        }

        const documents = await Document.find(query)
            .populate('project', 'name milestones')
            .populate('uploadedBy', 'name')
            .sort({ createdAt: -1 });

        const formattedDocs = documents.map(doc => {
            const docObj = doc.toObject();
            const milestoneObj = doc.project?.milestones?.find(
                m => m._id.toString() === doc.milestoneId.toString()
            );

            return {
                ...docObj,
                milestoneName: milestoneObj ? milestoneObj.name : 'Unknown', 
                project: {
                    _id: doc.project._id,
                    name: doc.project.name
                }
            };
        });

        res.json(formattedDocs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Approvals (Pending & Approved History)
// @route   GET /api/team-portal/approvals?status=...
export const getPendingApprovals = async (req, res) => {
    try {
        const userId = req.user._id;
        const { status } = req.query; 

        let taskQuery = { assignedTo: userId };
        let docQuery = { uploadedBy: userId };

        if (status === 'Approved') {
            taskQuery.status = 'Completed';
            docQuery.status = 'Approved';
        } else if (status === 'Pending') {
            taskQuery.status = 'Waiting for Approval';
            docQuery.status = 'Review';
        } else {
            // Default "All"
            taskQuery.status = { $in: ['Waiting for Approval', 'Completed'] };
            docQuery.status = { $in: ['Review', 'Approved'] };
        }

        const tasks = await Task.find(taskQuery)
            .populate('project', 'name')
            .sort({ updatedAt: -1 });

        const documents = await Document.find(docQuery)
            .populate('project', 'name')
            .sort({ updatedAt: -1 });

        res.json({ tasks, documents });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get Items Needing Revision
// @route   GET /api/team-portal/reviews
export const getItemsForReview = async (req, res) => {
    try {
        const userId = req.user._id;

        const tasks = await Task.find({ 
            assignedTo: userId, 
            status: 'In Progress', 
            adminFeedback: { $exists: true, $ne: "" } 
        }).populate('project', 'name');

        const documents = await Document.find({ 
            uploadedBy: userId, 
            status: 'Revision Requested' 
        }).populate('project', 'name');

        res.json({ tasks, documents });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};