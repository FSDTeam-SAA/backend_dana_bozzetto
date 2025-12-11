import { Server } from 'socket.io';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`User Connected: ${socket.id}`);

    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(userId);
        console.log(`User ${userId} joined their personal room`);
      }
    });

    socket.on('join_project', (projectId) => {
      if (projectId) {
        socket.join(projectId);
        console.log(`Socket ${socket.id} joined project room: ${projectId}`);
      }
    });

    socket.on('disconnect', () => {
      console.log('User Disconnected', socket.id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};