import { Server } from 'socket.io';
import jwt from 'jsonwebtoken'; 

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

    socket.on('typing', (room) => socket.in(room).emit('typing'));
    socket.on('stop typing', (room) => socket.in(room).emit('stop typing'));

    socket.on('new message', (newMessageReceived) => {
      var chat = newMessageReceived.chat;

      if (!chat.users) return console.log('Chat.users not defined');

      chat.users.forEach((user) => {
        if (user._id === newMessageReceived.sender._id) return; 
        socket.in(user._id).emit('message received', newMessageReceived);
      });
    });

    socket.on('disconnect', () => {
      console.log('USER DISCONNECTED');
    });
  });

  return io;
};