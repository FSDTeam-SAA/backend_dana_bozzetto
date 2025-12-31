import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Message } from '../model/Message.js';
import { Chat } from '../model/Chat.js';
import { Notification } from '../model/Notification.js';
import User from '../model/User.js';

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    pingTimeout: 60000,
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    let token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    if (token.startsWith('Bearer ')) {
        token = token.slice(7, token.length).trimLeft();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; 
      next(); 
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.userId;
    
    socket.join(userId);
    console.log(`Socket connected: ${socket.id} for User: ${userId}`);
    socket.emit('connected');

    socket.on('join chat', (room) => {
      socket.join(room);
      console.log(`User ${userId} joined chat room: ${room}`);
    });

    socket.on('leave chat', (room) => {
        socket.leave(room);
        console.log(`User ${userId} left chat room: ${room}`);
    });

    socket.on('typing', (room) => socket.in(room).emit('typing', userId));
    socket.on('stop typing', (room) => socket.in(room).emit('stop typing'));

    socket.on('message:send', async (payload) => {
        try {
            const { chatId, content, attachments, replyTo } = payload;

            if (!chatId || (!content && (!attachments || attachments.length === 0))) {
                return; 
            }

            var newMessageData = {
                sender: userId,
                content: content || '',
                chat: chatId,
                readBy: [userId],
                attachments: attachments || [], 
                replyTo: replyTo || null
            };

            let message = await Message.create(newMessageData);

            message = await message.populate('sender', 'name avatar email role');
            message = await message.populate('chat');
            message = await message.populate({
                path: 'replyTo',
                select: 'content sender',
                populate: { path: 'sender', select: 'name' }
            });

            message = await User.populate(message, {
                path: 'chat.users',
                select: 'name email avatar',
            });

            await Chat.findByIdAndUpdate(chatId, { latestMessage: message });

            io.in(chatId).emit('message received', message);

            const chat = await Chat.findById(chatId);
            if (chat && chat.users) {
                const recipients = chat.users.filter(u => u.toString() !== userId.toString());
                
                let notifText = content ? content.substring(0, 30) : 'Sent an attachment';
                if (content && content.length > 30) notifText += '...';

                // We use the User model to get the sender's name for the notification
                const senderUser = await User.findById(userId).select('name');
                const senderName = senderUser ? senderUser.name : 'Someone';

                const notificationPromises = recipients.map(recipientId => 
                    Notification.create({
                        recipient: recipientId,
                        sender: userId,
                        type: 'Message',
                        message: `New message from ${senderName}: ${notifText}`,
                        relatedId: chat._id, 
                        onModel: 'Chat' 
                    })
                );
                await Promise.all(notificationPromises);
            }

        } catch (error) {
            console.error("Socket Message Error:", error);
            socket.emit('message:error', { message: error.message });
        }
    });

    socket.on('disconnect', () => {
      console.log('USER DISCONNECTED');
      socket.leave(userId);
    });
  });

  return io;
};