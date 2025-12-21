import mongoose from 'mongoose';

const financeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Invoice', 'Estimate', 'Proposal', 'Contract'],
      required: true,
    },
    customId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lineItems: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, required: true, default: 1 },
        rate: { type: Number, required: true },
        amount: { type: Number, required: true },
        _id: false,
      }
    ],
    subtotal: {
      type: Number,
      default: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: [
        'Draft', 
        'Pending', 
        'Sent',
        'Approved', 
        'Rejected', 
        'Paid',    
        'Unpaid',  
        'Overdue',
        'Signed'  
      ],
      default: 'Pending',
    },
    notes: {
      type: String,
    },
    file: {
      public_id: { type: String },
      url: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

export const Finance = mongoose.model('Finance', financeSchema);