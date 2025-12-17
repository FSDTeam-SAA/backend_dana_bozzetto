import { Project } from '../model/Project.js';
import { Task } from '../model/Task.js';
import { Document } from '../model/Document.js';

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
    // Fetch tasks due today OR in progress
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
    // We need: Image, Name, Owner Name, Deadline, Milestone Progress (e.g. 2/4)
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
        milestoneProgress: `${currentMilestoneIndex}/${totalMilestones}`,
        teamAvatars: project.teamMembers.map(tm => tm.user?.avatar).filter(Boolean).slice(0, 3) // Show top 3
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
      dateFilter = { endDate: { $gte: startDate, $lte: endDate } };
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
    // First get project IDs
    const projectIds = await Project.find({ 'teamMembers.user': userId }).distinct('_id');
    
    const documents = await Document.find({
      project: { $in: projectIds },
      name: regex
    }).select('name type file.url');

    res.json({ projects, documents });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update Task Status (Done / Dispute)
// @route   PUT /api/team-portal/tasks/:id/status
// @access  Private (Team Member)
export const updateMemberTaskStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'Done' or 'Dispute' or 'In Progress'
    const taskId = req.params.id;
    const userId = req.user._id;

    const task = await Task.findOne({ _id: taskId, assignedTo: userId });

    if (!task) {
      return res.status(404).json({ message: 'Task not found or not assigned to you' });
    }

    // Logic for Dispute
    if (status === 'Dispute') {
       task.status = 'On Hold'; // Or a specific 'Disputed' status if added to enum
       // Ideally, trigger a notification to Admin here (We will handle this via Notification Logic later)
    } else {
       task.status = status;
    }
    
    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};