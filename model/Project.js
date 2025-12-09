import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    projectNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, "A project must have a client"],
    },
    teamMembers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: String,
          default: "Contributor",
        },
        _id: false,
      },
    ],
    status: {
      type: String,
      enum: ['Active', 'Pending', 'Completed', 'On Hold', 'Archived'],
      default: 'Active',
    },
    location: {
      type: String,
      required: true,
    },
    budget: {
      type: Number,
      default: 0,
    },
    totalPaid: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    milestones: [
      {
        name: {
          type: String,
          required: [true, "Milestone title is required"], 
        },
        status: {
          type: String,
          enum: ['Pending', 'In Progress', 'Completed', 'Active'],
          default: 'Pending',
        },
        progress: {
          type: Number,
          default: 0,
        },
        isEnabled: {
          type: Boolean,
          default: true,
        },
      },
    ],
    overallProgress: {
      type: Number,
      default: 0,
    },
    coverImage: {
      public_id: { type: String, default: "" },
      url: { type: String, default: "" },
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

projectSchema.virtual('tasks', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'project',
});

projectSchema.virtual('invoices', {
  ref: 'Invoice',
  localField: '_id',
  foreignField: 'project',
});

const Project = mongoose.model('Project', projectSchema);

export default Project;