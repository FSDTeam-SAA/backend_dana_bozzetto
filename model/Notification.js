import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    title: {
      type: String,
      required: true,
      trim: true, 
    },
    message: {
      type: String,
      required: true, 
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ['info', 'alert', 'success', 'warning'],
      default: 'info',
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    relatedModel: {
      type: String,
      enum: ['Project', 'Task', 'Document', 'Finance', 'User'],
    },
  },
  {
    timestamps: true, 
  }
);

export const Notification = mongoose.model('Notification', notificationSchema);