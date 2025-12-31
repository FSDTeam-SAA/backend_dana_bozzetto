import { Chat } from '../model/Chat.js';
import User from '../model/User.js';
import { Project } from '../model/Project.js';

// @desc    Access a Chat (1-on-1 per Project)
// @route   POST /api/chats
// @access  Private
export const accessChat = async (req, res) => {
  // We need the other user's ID AND the project ID to define this unique room
  const { userId, projectId } = req.body;

  if (!userId || !projectId) {
    return res.status(400).json({ message: 'UserId and ProjectId params not sent with request' });
  }

  // 1. Check if a chat exists between these TWO users for THIS project
  var isChat = await Chat.find({
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } }, // You
      { users: { $elemMatch: { $eq: userId } } },       // Them
      { project: projectId }                            // Specific Project Context
    ],
  })
    .populate('users', '-password')
    .populate('latestMessage')
    .populate('project', 'name projectNo status'); // Populate project info

  isChat = await User.populate(isChat, {
    path: 'latestMessage.sender',
    select: 'name avatar email',
  });

  if (isChat.length > 0) {
    res.send(isChat[0]);
  } else {
    // 2. Create new chat if none exists
    var chatData = {
      chatName: 'sender', // Placeholder, frontend usually names it by the other user
      users: [req.user._id, userId],
      project: projectId
    };

    try {
      const createdChat = await Chat.create(chatData);
      
      const FullChat = await Chat.findOne({ _id: createdChat._id })
        .populate('users', '-password')
        .populate('project', 'name projectNo status');

      res.status(200).send(FullChat);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
};

// @desc    Fetch all chats for the logged-in user
// @route   GET /api/chats
// @access  Private
export const fetchChats = async (req, res) => {
  try {
    // Optional: Filter by project if passed in query (e.g., ?projectId=...)
    const { projectId } = req.query;
    
    let query = { 
        users: { $elemMatch: { $eq: req.user._id } } 
    };

    if (projectId) {
        query.project = projectId;
    }

    Chat.find(query)
      .populate('users', '-password')
      .populate('project', 'name projectNo status')
      .populate('latestMessage')
      .sort({ updatedAt: -1 }) // Sort by most recent activity
      .then(async (results) => {
        results = await User.populate(results, {
          path: 'latestMessage.sender',
          select: 'name avatar email',
        });
        res.status(200).send(results);
      });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};