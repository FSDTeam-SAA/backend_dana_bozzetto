import { Message } from '../model/Message.js';
import User from '../model/User.js';
import { Chat } from '../model/Chat.js'; 
import { Notification } from '../model/Notification.js';

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
    const io = req.app.get('io'); // Access global io instance
    io.in(chatId).emit('message received', message);

    // 5. NOTIFICATION TRIGGER: Notify Recipient(s)
    // We don't want to notify the sender or people currently looking at the chat (handled by socket),
    // but for persistent storage, we add a notification.
    const chat = await Chat.findById(chatId);
    if (chat && chat.users) {
        const recipients = chat.users.filter(userId => userId.toString() !== req.user._id.toString());
        
        const notificationPromises = recipients.map(recipientId => 
            Notification.create({
                recipient: recipientId,
                sender: req.user._id,
                type: 'Message',
                message: `New message from ${req.user.name}: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`,
                relatedId: chat._id, // Link to the chat
                onModel: 'Project' // Using Project schema for generic linking or if you create a Chat model ref in Notification
            })
        );
        // Note: We use 'Project' as onModel/refPath fallback or you can update Notification schema to support 'Chat'
        // For now, this creates the record. To be perfectly strict, you should add 'Chat' to the enum in Notification model.
        await Promise.all(notificationPromises);
    }

    res.json(message);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};