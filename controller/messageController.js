import { Message } from '../model/Message.js';
import User from '../model/User.js';
import { Project } from '../model/Project.js';

// @desc    Send a message (Direct or Project Group)
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const { 
      projectId, 
      recipientId, 
      text, 
      attachments 
    } = req.body;

    const senderId = req.user._id;

    // 1. Create the Message Object
    let messageData = {
      sender: senderId,
      text,
      attachments: attachments || [],
      readBy: [{ user: senderId }] // Sender has read their own message
    };

    // 2. Determine Context (Project Chat vs Direct Message)
    if (projectId) {
      messageData.project = projectId;
    } else if (recipientId) {
      messageData.recipient = recipientId;
    } else {
      return res.status(400).json({ message: 'Message must have a recipient or project' });
    }

    // 3. Save to DB
    let message = await Message.create(messageData);
    
    // Populate sender details for the frontend to display immediately
    message = await message.populate('sender', 'name avatar role');

    // 4. REAL-TIME SOCKET EMIT
    // We access the 'io' instance we attached to the app in server.js
    const io = req.app.get('io');

    if (projectId) {
      // Emit to everyone in the project room
      io.to(projectId).emit('new_message', message);
    } else if (recipientId) {
      // Emit to the specific user's private room
      io.to(recipientId).emit('new_message', message);
    }

    res.status(201).json(message);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get messages for a Project or User
// @route   GET /api/messages
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const { projectId, userId } = req.query;
    let query = {};

    if (projectId) {
      // Get chat history for a specific project
      query = { project: projectId };
    } else if (userId) {
      // Get Direct Messages between logged-in user AND the other user
      query = {
        $or: [
          { sender: req.user._id, recipient: userId },
          { sender: userId, recipient: req.user._id }
        ]
      };
    } else {
        return res.status(400).json({ message: 'Please provide projectId or userId' });
    }

    const messages = await Message.find(query)
      .populate('sender', 'name avatar role')
      .sort({ createdAt: 1 }); // Oldest first (Standard chat order)

    res.json(messages);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get recent conversations (For the "Messages" list sidebar)
// @route   GET /api/messages/conversations
// @access  Private
export const getConversations = async (req, res) => {
  try {
    // This is a complex query to find unique users/projects the user has chatted with.
    // For simplicity in this iteration, we will fetch projects the user is assigned to
    // and display them as "Chat Groups".
    
    // 1. Get Projects
    let projectQuery = {};
    if (req.user.role === 'client') {
        projectQuery = { client: req.user._id };
    } else if (req.user.role === 'team_member') {
        projectQuery = { 'teamMembers.user': req.user._id };
    }
    
    // Admin sees all? Or maybe just ones they are managing. 
    // Let's assume Admin sees all active projects for now.
    
    const projects = await Project.find(projectQuery).select('name projectNo status');

    // Return format matching the sidebar UI
    const conversations = projects.map(p => ({
        id: p._id,
        name: p.name,
        type: 'project',
        // In a real app, you'd fetch the last message for the preview text here
        lastMessage: 'Click to view chat', 
        unreadCount: 0 
    }));

    res.json(conversations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};