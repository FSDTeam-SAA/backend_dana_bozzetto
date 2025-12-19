import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import http from 'http';
import mainRoutes from './mainroute/index.js';
import { initSocket } from './utils/socket.js'; // Import the separated logic

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Create HTTP server (Wrap Express)
const server = http.createServer(app);

// Initialize Socket.io (using the separate file)
const io = initSocket(server);

// Make 'io' accessible globally via req.app.get('io') in controllers
app.set('io', io);

// Middleware
// UPDATED: Specific CORS config is required for Socket.io + Frontend credentials
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Database Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Routes
app.use('/api', mainRoutes);

// Base Route
app.get('/', (req, res) => {
  res.send('Architectural Project Management API is running...');
});

// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

// Start Server
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log(`Socket.io is ready for connections`);
  });
});