import { Task } from '../model/Task.js';
import { Project } from '../model/Project.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

// @desc    Create a new task (Admin or Team)
// @route   POST /api/tasks
// @access  Private
export const createTask = async (req, res) => {
  try {
    const { name, projectId, milestoneId, assignedTo, priority, startDate, endDate } = req.body;

    const task = await Task.create({
      name,
      project: projectId,
      milestoneId,
      assignedTo,
      priority,
      startDate,
      endDate,
      status: 'Pending'
    });

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get Tasks for a Project
// @route   GET /api/tasks?projectId=...
// @access  Private
export const getTasks = async (req, res) => {
  try {
    const { projectId } = req.query;
    const tasks = await Task.find({ project: projectId })
      .populate('assignedTo', 'name avatar')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Submit Task for Approval (Team Member)
// @route   POST /api/tasks/:id/submit
// @access  Private (Team Member)
export const submitTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    const { docName, docType, notes } = req.body; 

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // Handle File Upload (Required for submission)
    let fileData = {};
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'architectural-portal/tasks');
      fileData = {
        public_id: result.public_id,
        url: result.secure_url,
        format: result.format,
        size: result.bytes 
      };
    } else {
        return res.status(400).json({ message: 'Document file is required for submission' });
    }

    // Update Task with Submission Data
    task.submission = {
      docName,
      docType,
      notes,
      file: fileData,
      submittedBy: req.user._id,
      submittedAt: new Date()
    };
    
    // Change status so it appears in Admin's "Approval" list
    task.status = 'Waiting for Approval';
    await task.save();

    res.json({ message: 'Task submitted for approval', task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Review Task (Admin) - Approve/Reject AND Auto-Complete Milestone
// @route   PUT /api/tasks/:id/review
// @access  Private (Admin)
export const reviewTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    const { status, feedback } = req.body; // status: 'Approved' or 'Rejected'

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (status === 'Approved') {
      task.status = 'Completed';
      
      // --- AUTOMATION: Check if Milestone is Complete ---
      // 1. Fetch all tasks for this specific project AND milestone
      const milestoneTasks = await Task.find({ 
        project: task.project, 
        milestoneId: task.milestoneId 
      });

      // 2. Check if any OTHER task is incomplete
      // (We filter out the current task because it is not saved as 'Completed' in DB yet)
      const pendingTasks = milestoneTasks.filter(t => 
        t._id.toString() !== taskId && t.status !== 'Completed'
      );

      // 3. If no tasks are pending, mark the Milestone as Completed
      if (pendingTasks.length === 0) {
        const project = await Project.findById(task.project);
        if (project) {
          const milestone = project.milestones.id(task.milestoneId);
          if (milestone) {
             milestone.status = 'Completed';
             
             // 4. Update Overall Project Progress %
             const totalMilestones = project.milestones.length;
             const completedMilestones = project.milestones.filter(m => m.status === 'Completed').length;
             // Avoid division by zero
             project.overallProgress = totalMilestones > 0 
               ? Math.round((completedMilestones / totalMilestones) * 100) 
               : 0;
             
             await project.save();
          }
        }
      }
      // --------------------------------------------------

    } else if (status === 'Rejected') {
      task.status = 'In Progress'; // Send back to team member
      task.adminFeedback = feedback; // Save rejection reason
    } else {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await task.save();
    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update Task Details (General Edit)
// @route   PUT /api/tasks/:id
// @access  Private
export const updateTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete Task
// @route   DELETE /api/tasks/:id
// @access  Private
export const deleteTask = async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};