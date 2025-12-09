import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Document name is required"],
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
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    file: {
      public_id: { type: String, required: true },
      url: { type: String, required: true },
      mimeType: { type: String }, 
      size: { type: Number }, 
    },
    type: {
      type: String,
      enum: ['PDF', 'DWG', 'JPG', 'PNG', 'Other'],
      default: 'PDF',
    },
    version: {
      type: Number,
      default: 1,
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Pending', 'Review', 'Approved', 'Rejected', 'Revision Requested'],
      default: 'Pending',
    },
    approvalRequestedDate: {
      type: Date,
    },
    approvalDueDate: {
      type: Date,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedDate: {
      type: Date,
    },
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Document = mongoose.model('Document', documentSchema);