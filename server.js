import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import morgan from 'morgan';
import http from 'http';
import cookieParser from 'cookie-parser'; // Import Cookie Parser

// Utils
import { initSocket } from './utils/socket.js';

// Master Router (Imports all other routes)
import mainRouter from './mainroute/index.js';

// Load env vars
dotenv.config();

// Connect to Database
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

connectDB();

const app = express();
const httpServer = http.createServer(app);

// Initialize Socket.io
const io = initSocket(httpServer);

// Make io accessible globally in req (e.g., req.app.get('io'))
app.set('io', io);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true // Vital for cookies to work with CORS
}));
app.use(express.json()); // Body parser
app.use(cookieParser()); // Cookie parser middleware
app.use(morgan('dev'));  // Logging

// Mount Master Router
// This routes all requests starting with /api to the main router
app.use('/api', mainRouter);

// Health Check
app.get('/', (req, res) => {
  res.send('API is running...');
});

app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});