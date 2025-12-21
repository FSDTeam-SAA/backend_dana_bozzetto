import { Project } from '../model/Project.js';
import { Task } from '../model/Task.js';
import { Document } from '../model/Document.js';
import { Notification } from '../model/Notification.js';

// @desc    Get Team Member Homepage Data (Dashboard)
// @route   GET /api/team-portal/dashboard
// @access  Private (Team Member)
export const getMemberDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 1. Today's Tasks
    // Fetch tasks due today OR in progress (Priority items)
    const todayTasks = await Task.find({
      assignedTo: userId,
      $or: [
        { endDate: { $gte: today, $lt: tomorrow } }, // Due today
        { status: 'In Progress' }
      ]
    }).populate('project', 'name').limit(5);

    // 2. Project Overview Stats (Active vs Pending Tasks)
    const totalActiveTasks = await Task.countDocuments({
      assignedTo: userId,
      status: 'In Progress'
    });

    const totalPendingTasks = await Task.countDocuments({
      assignedTo: userId,
      status: 'Pending'
    });

    // 3. Assigned Projects (Card View)
    // We need: Image, Name, Owner Name, Deadline, Milestone Progress
    const projects = await Project.find({ 'teamMembers.user': userId })
      .populate('client', 'name')
      .populate('teamMembers.user', 'avatar')
      .sort({ endDate: 1 });

    const assignedProjects = projects.map(project => {
      const totalMilestones = project.milestones.length;
      const completedMilestones = project.milestones.filter(m => m.status === 'Completed').length;
      
      // Calculate current milestone index (1-based)
      let currentMilestoneIndex = completedMilestones + 1;
      if (currentMilestoneIndex > totalMilestones) currentMilestoneIndex = totalMilestones;

      return {
        _id: project._id,
        name: project.name,
        clientName: project.client ? project.client.name : 'Unknown',
        status: project.status,
        deadline: project.endDate,
        coverImage: project.coverImage?.url || '',
        milestoneProgress: `${currentMilestoneIndex}/${totalMilestones}`, // e.g. "2/4"
        overallProgress: project.overallProgress,
        teamAvatars: project.teamMembers.map(tm => tm.user?.avatar?.url).filter(Boolean).slice(0, 3) // Show top 3 avatars
      };
    });

    res.json({
      userName: req.user.name,
      todayTasks,
      stats: {
        activeTasks: totalActiveTasks,
        pendingTasks: totalPendingTasks
      },
      assignedProjects
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get Tasks for Calendar View
// @route   GET /api/team-portal/calendar
// @access  Private (Team Member)
export const getMemberCalendar = async (req, res) => {
  try {
    const userId = req.user._id;
    const { month, year } = req.query;

    let dateFilter = {};
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      
      // Filter tasks that fall within this month (Start OR End date)
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

// @desc    Global Search (Projects & Documents)
// @route   GET /api/team-portal/search?q=...
// @access  Private (Team Member)
export const searchGlobal = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user._id;

    if (!q) return res.json({ projects: [], documents: [] });

    const regex = new RegExp(q, 'i');

    // Search Projects user is part of
    const projects = await Project.find({
      'teamMembers.user': userId,
      name: regex
    }).select('name status coverImage');

    // Search Documents in those projects
    // First get project IDs user belongs to
    const userProjects = await Project.find({ 'teamMembers.user': userId }).select('_id');
    const projectIds = userProjects.map(p => p._id);
    
    const documents = await Document.find({
      project: { $in: projectIds },
      name: regex
    }).select('name type file.url');

    res.json({ 
        projects: projects.map(p => ({
            _id: p._id,
            name: p.name,
            status: p.status,
            image: p.coverImage?.url
        })), 
        documents 
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update Task Status (Quick Action: Done / Dispute)
// @route   PUT /api/team-portal/tasks/:id/status
// @access  Private (Team Member)
export const updateMemberTaskStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'Done', 'Dispute', 'In Progress'
    const taskId = req.params.id;
    const userId = req.user._id;

    const task = await Task.findOne({ _id: taskId, assignedTo: userId });

    if (!task) {
      return res.status(404).json({ message: 'Task not found or not assigned to you' });
    }

    // Logic for Dispute
    if (status === 'Dispute') {
       task.status = 'On Hold'; 
       
       // Trigger Notification to Admins
       // (Admin needs to know a task is disputed/stuck)
       // We can iterate admin users and notify
    } else if (status === 'Done') {
        task.status = 'Completed'; 
        // Note: Usually "Submit" is preferred for review, but "Done" might be for simple tasks
    } else {
       task.status = status;
    }
    
    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};