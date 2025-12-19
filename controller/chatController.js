import { Chat } from '../model/Chat.js';
import User from '../model/User.js';

// @desc    Access a Chat (Create or Fetch 1-on-1)
// @route   POST /api/chats
// @access  Private
export const accessChat = async (req, res) => {
  const { userId } = req.body; // The ID of the person you want to chat with

  if (!userId) {
    return res.status(400).json({ message: 'UserId param not sent with request' });
  }

  // 1. Check if chat exists
  var isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate('users', '-password')
    .populate('latestMessage');

  isChat = await User.populate(isChat, {
    path: 'latestMessage.sender',
    select: 'name avatar email',
  });

  if (isChat.length > 0) {
    res.send(isChat[0]);
  } else {
    // 2. Create new chat if none exists
    var chatData = {
      chatName: 'sender',
      isGroupChat: false,
      users: [req.user._id, userId],
    };

    try {
      const createdChat = await Chat.create(chatData);
      const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        'users',
        '-password'
      );
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
    Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
      .populate('users', '-password')
      .populate('groupAdmin', '-password')
      .populate('latestMessage')
      .sort({ updatedAt: -1 })
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

// @desc    Create Group Chat (Manual or for Project)
// @route   POST /api/chats/group
// @access  Private
export const createGroupChat = async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: 'Please fill all the fields' });
  }

  // Frontend sends stringified array of userIds
  var users = JSON.parse(req.body.users);

  if (users.length < 2) {
    return res.status(400).send({ message: 'More than 2 users are required to form a group chat' });
  }

  // Add currently logged in user (Admin/Creator)
  users.push(req.user);

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user,
      project: req.body.projectId || null // Optional: Link to project
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate('users', '-password')
      .populate('groupAdmin', '-password');

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};