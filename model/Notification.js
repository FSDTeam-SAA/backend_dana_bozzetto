import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true, // Who receives the notification
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Who triggered it (Admin, Client, or Team Member)
    },
    type: {
      type: String,
      enum: ['Task Assigned', 'Task Submitted', 'Task Reviewed', 'Document Uploaded', 'Approval Request', 'Message'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    // Dynamic Reference: Links to Task, Project, Document, Finance, or Chat
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'onModel', 
    },
    onModel: {
      type: String,
      required: true,
      // Added 'Chat' to allow linking notifications to chat rooms
      enum: ['Task', 'Project', 'Document', 'Finance', 'Chat'], 
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Automatic createdAt, updatedAt
  }
);

export const Notification = mongoose.model('Notification', notificationSchema);