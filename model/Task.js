import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    milestoneId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true, 
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Waiting for Approval', 'Completed', 'On Hold'],
      default: 'Pending',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    startDate: Date,
    endDate: Date,
    submission: {
      docName: String, 
      docType: String, 
      notes: String,
      file: {
        public_id: String,
        url: String,
        format: String,
        size: Number
      },
      submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      submittedAt: Date,
    },
    adminFeedback: String
  },
  {
    timestamps: true,
  }
);

export const Task = mongoose.model('Task', taskSchema);