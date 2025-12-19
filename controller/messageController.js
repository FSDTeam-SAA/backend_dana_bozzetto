import { Message } from '../model/Message.js';
import User from '../model/User.js';
import { Chat } from '../model/Chat.js'; // Assuming you will have a Chat model for grouping

// @desc    Get all messages for a specific chat
// @route   GET /api/messages/:chatId
// @access  Private
export const allMessages = async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate('sender', 'name avatar email')
      .populate('chat');
      
    res.json(messages);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Send a new message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    return res.status(400).json({ message: 'Invalid data passed into request' });
  }

  var newMessage = {
    sender: req.user._id,
    content: content,
    chat: chatId,
  };

  try {
    // 1. Save to Database
    let message = await Message.create(newMessage);

    // 2. Populate sender info (for frontend display)
    message = await message.populate('sender', 'name avatar');
    message = await message.populate('chat');
    message = await User.populate(message, {
      path: 'chat.users',
      select: 'name email avatar',
    });

    // 3. Update Latest Message in Chat (for sidebar sorting)
    await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

    // 4. REAL-TIME: Emit to Socket.io Room
    // This pushes the message to everyone in this chat room instantly
    const io = req.app.get('io'); // Access global io instance
    io.in(chatId).emit('message received', message);

    res.json(message);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};