import { Server } from 'socket.io';

export const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    pingTimeout: 60000,
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('Connected to socket.io:', socket.id);

    // 1. Setup User Room (Login)
    // Frontend should emit 'setup' with user data after login
    socket.on('setup', (userData) => {
      socket.join(userData._id);
      console.log(`User joined personal room: ${userData._id}`);
      socket.emit('connected');
    });

    // 2. Join Chat Room
    // Frontend emits this when entering a specific chat page
    socket.on('join chat', (room) => {
      socket.join(room);
      console.log(`User joined chat room: ${room}`);
    });

    // 3. Typing Indicators
    socket.on('typing', (room) => socket.in(room).emit('typing'));
    socket.on('stop typing', (room) => socket.in(room).emit('stop typing'));

    // 4. New Message Handling
    // (Note: The MessageController also emits 'message received', 
    // but this listener enables client-to-client echoing if needed)
    socket.on('new message', (newMessageReceived) => {
      var chat = newMessageReceived.chat;

      if (!chat.users) return console.log('Chat.users not defined');

      chat.users.forEach((user) => {
        if (user._id === newMessageReceived.sender._id) return; // Don't send to self
        
        // Send to the specific user's personal room
        // This ensures they get the message notification even if they aren't in the chat room
        socket.in(user._id).emit('message received', newMessageReceived);
      });
    });

    socket.on('disconnect', () => {
      console.log('USER DISCONNECTED');
    });
  });

  return io;
};