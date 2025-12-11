import { Task } from '../model/Task.js';
import  {Project}  from '../model/Project.js';
import User from '../model/User.js';

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private (Admin or Team Member)
export const createTask = async (req, res) => {
  try {
    const {
      name,
      description,
      projectId,
      milestoneId, 
      assignedTo, 
      startDate,
      endDate,
      priority
    } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const milestoneExists = project.milestones.id(milestoneId);
    if (!milestoneExists) {
      return res.status(400).json({ message: 'Invalid Milestone ID for this project' });
    }

    const task = await Task.create({
      name,
      description,
      project: projectId,
      milestoneId,
      assignedTo,
      startDate,
      endDate,
      priority,
      status: 'Pending'
    });

    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get tasks for a specific project (Grouped by Frontend)
// @route   GET /api/tasks/project/:projectId
// @access  Private
export const getProjectTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ project: req.params.projectId })
      .populate('assignedTo', 'name avatar role')
      .sort({ startDate: 1 }); 

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get logged-in user's assigned tasks (For "Today's Tasks" Dashboard)
// @route   GET /api/tasks/my-tasks
// @access  Private
export const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ 
      assignedTo: req.user._id,
      status: { $ne: 'Done' } 
    })
    .populate('project', 'name projectNo') // Show which project the task belongs to
    .sort({ endDate: 1 }); // Urgent deadlines first

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update task status or details
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isAssigned = task.assignedTo && task.assignedTo.toString() === req.user._id.toString();

    if (!isAdmin && !isAssigned) {
      return res.status(403).json({ message: 'Not authorized to update this task' });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json(updatedTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
// @access  Private (Admin Only)
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await task.deleteOne();
    res.json({ message: 'Task removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};