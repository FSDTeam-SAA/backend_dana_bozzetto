import Project from '../model/Project.js';
import User from '../model/User.js';

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private/Admin
export const createProject = async (req, res) => {
  try {
    const {
      projectNo,
      name,
      description,
      clientId, // ID of the client user
      budget,
      startDate,
      endDate,
      location,
      status,
      teamMembers, // Array of { user: userId, role: string }
      milestones
    } = req.body;

    // Verify Client exists
    const clientUser = await User.findById(clientId);
    if (!clientUser || clientUser.role !== 'client') {
      return res.status(400).json({ message: 'Invalid Client ID provided' });
    }

    const project = await Project.create({
      projectNo,
      name,
      description,
      client: clientId,
      budget,
      startDate,
      endDate,
      location,
      status,
      teamMembers: teamMembers || [],
      milestones: milestones || [], // Can initialize with defaults if sent
    });

    res.status(201).json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all projects (Filtered by Role)
// @route   GET /api/projects
// @access  Private
export const getProjects = async (req, res) => {
  try {
    let query = {};

    // Role-based filtering
    if (req.user.role === 'client') {
      // Client sees only their own projects
      query = { client: req.user._id };
    } else if (req.user.role === 'team_member') {
      // Team member sees projects they are assigned to
      query = { 'teamMembers.user': req.user._id };
    }
    // Admin sees everything (empty query)

    const projects = await Project.find(query)
      .populate('client', 'name email avatar')
      .populate('teamMembers.user', 'name role avatar');

    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single project details
// @route   GET /api/projects/:id
// @access  Private
export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('client', 'name email phoneNumber address avatar')
      .populate('teamMembers.user', 'name email role avatar employeeId');

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Security check: Ensure the user is actually allowed to view this specific project
    if (req.user.role === 'client' && project.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to view this project' });
    }
    // (Similar check could be added for team_member if strict privacy is needed)

    res.json(project);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update project details
// @route   PUT /api/projects/:id
// @access  Private/Admin
export const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json(updatedProject);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add a Milestone to a Project
// @route   POST /api/projects/:id/milestones
// @access  Private/Admin
export const addMilestone = async (req, res) => {
  try {
    const { name, status } = req.body; // e.g. "Site Survey"
    
    const project = await Project.findById(req.params.id);
    if (!project) {
        return res.status(404).json({ message: 'Project not found' });
    }

    // Add new milestone to the array
    project.milestones.push({ name, status: status || 'Pending' });
    await project.save();

    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private/Admin
export const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    await project.deleteOne();
    res.json({ message: 'Project removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};