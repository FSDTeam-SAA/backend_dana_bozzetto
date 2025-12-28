import { Message } from '../model/Message.js';
import User from '../model/User.js';
import { Chat } from '../model/Chat.js'; 
import { Notification } from '../model/Notification.js';

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

export const sendMessage = async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    return res.status(400).json({ message: 'Invalid data passed into request' });
  }

  var newMessage = {
    sender: req.user._id,
    content: content,
    chat: chatId,
    readBy: [req.user._id] 
  };

  try {
    let message = await Message.create(newMessage);

    message = await message.populate('sender', 'name avatar');
    message = await message.populate('chat');
    message = await User.populate(message, {
      path: 'chat.users',
      select: 'name email avatar',
    });

    await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

    const io = req.app.get('io');
    io.in(chatId).emit('message received', message);

    const chat = await Chat.findById(chatId);
    if (chat && chat.users) {
        const recipients = chat.users.filter(userId => userId.toString() !== req.user._id.toString());
        
        const notificationPromises = recipients.map(recipientId => 
            Notification.create({
                recipient: recipientId,
                sender: req.user._id,
                type: 'Message',
                message: `New message from ${req.user.name}: ${content.substring(0, 30)}${content.length > 30 ? '...' : ''}`,
                relatedId: chat._id, 
                onModel: 'Chat' 
            })
        );
        await Promise.all(notificationPromises);
    }

    res.json(message);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    await Message.updateMany(
      { chat: chatId, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};