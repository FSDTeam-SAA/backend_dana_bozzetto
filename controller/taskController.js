import { Task } from '../model/Task.js';
import { Project } from '../model/Project.js';
import { Notification } from '../model/Notification.js'; 
import User from '../model/User.js'; 
import { uploadToCloudinary } from '../utils/cloudinary.js';

// @desc    Create a new task (Admin or Team)
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

    // NOTIFICATION TRIGGER: If assigned to someone, notify them
    if (assignedTo) {
      await Notification.create({
        recipient: assignedTo,
        sender: req.user._id,
        type: 'Task Assigned',
        message: `You have been assigned a new task: ${name}`,
        relatedId: task._id,
        onModel: 'Task'
      });
    }

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get Tasks for a Project
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

// @desc    Submit Task for Approval (Team Member) - Uploads file
export const submitTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    // Matches fields from your "Upload Document" UI Modal
    const { docName, docType, notes } = req.body; 

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

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

    task.submission = {
      docName, // e.g. "Pre-Design"
      docType, // e.g. "PDF", "DWG"
      notes,
      file: fileData,
      submittedBy: req.user._id,
      submittedAt: new Date()
    };
    
    task.status = 'Waiting for Approval';
    await task.save();

    // NOTIFICATION TRIGGER: Notify ALL Admins
    const admins = await User.find({ role: 'admin' });
    const notificationPromises = admins.map(admin => 
      Notification.create({
        recipient: admin._id,
        sender: req.user._id,
        type: 'Task Submitted',
        message: `${req.user.name} submitted task "${task.name}" for approval.`,
        relatedId: task._id,
        onModel: 'Task'
      })
    );
    await Promise.all(notificationPromises);

    res.json({ message: 'Task submitted for approval', task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Review Task (Admin) - Approve/Reject AND Check Milestone Completion
export const reviewTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    const { status, feedback } = req.body; 

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (status === 'Approved') {
      task.status = 'Completed';
      
      // LOGIC: Check if ALL tasks in this milestone are now completed
      // 1. Find all tasks for this project & milestone
      const milestoneTasks = await Task.find({ 
        project: task.project, 
        milestoneId: task.milestoneId 
      });

      // 2. Filter for any that are NOT completed (excluding the current one we just approved)
      const pendingTasks = milestoneTasks.filter(t => 
        t._id.toString() !== taskId && t.status !== 'Completed'
      );

      // 3. If no pending tasks, mark Milestone as "Completed" (Internal Logic)
      // Note: The Admin still needs to upload the "Final Deliverable" manually in the Project Controller
      // but we can update the status here to reflect progress.
      if (pendingTasks.length === 0) {
        const project = await Project.findById(task.project);
        if (project) {
          const milestone = project.milestones.id(task.milestoneId);
          if (milestone) {
             // milestone.status = 'Completed'; // Optional: Or keep it pending until Admin uploads final doc
             // For now, let's leave milestone status management to the "Upload Milestone Document" action
             // to ensure the Client doesn't see a "Completed" milestone without a document.
          }
        }
      }

    } else if (status === 'Rejected') {
      task.status = 'In Progress'; // Send back to team member
      task.adminFeedback = feedback; 
    } else {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await task.save();

    // NOTIFICATION TRIGGER: Notify the Team Member
    if (task.assignedTo) {
      await Notification.create({
        recipient: task.assignedTo,
        sender: req.user._id,
        type: 'Task Reviewed',
        message: `Your task "${task.name}" was ${status}. ${feedback ? `Feedback: ${feedback}` : ''}`,
        relatedId: task._id,
        onModel: 'Task'
      });
    }

    res.json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update Task Details
export const updateTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete Task
export const deleteTask = async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};