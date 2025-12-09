import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Task name is required"], 
      trim: true,
    },
    description: {
      type: String, 
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
      enum: ['Pending', 'Wip', 'Done', 'Dispute'],
      default: 'Pending',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },

    attachments: [
      {
        public_id: String,
        url: String,
        type: String,
      }
    ]
  },
  {
    timestamps: true,
  }
);

export const Task = mongoose.model('Task', taskSchema);