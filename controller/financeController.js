import { Finance } from '../model/Finance.js';
import User from '../model/User.js';
import { Project } from '../model/Project.js';

// @desc    Create a new financial document (Invoice, Estimate, etc.)
// @route   POST /api/finance
// @access  Private (Admin Only)
export const createFinance = async (req, res) => {
  try {
    const {
      type, // 'Invoice', 'Estimate', 'Proposal', 'Contract'
      projectId,
      clientId,
      lineItems, // Array of { description, quantity, rate, amount }
      taxRate,
      discount,
      issueDate,
      dueDate,
      notes
    } = req.body;

    // 1. Generate a Custom ID (e.g. INV-2025-001)
    // Note: Using countDocuments is simple but can have race conditions in high traffic. 
    // For this app, it's acceptable.
    const count = await Finance.countDocuments({ type });
    const year = new Date().getFullYear();
    const shortType = type === 'Invoice' ? 'INV' : type === 'Estimate' ? 'EST' : type === 'Contract' ? 'CNT' : 'PROP';
    const customId = `${shortType}-${year}-${String(count + 1).padStart(3, '0')}`;

    // 2. Calculate Totals (Backend validation to prevent frontend math errors)
    let subtotal = 0;
    if (Array.isArray(lineItems)) {
        lineItems.forEach(item => {
        subtotal += (item.quantity || 0) * (item.rate || 0);
        });
    }
    
    const taxAmount = subtotal * ((taxRate || 0) / 100);
    const totalAmount = subtotal + taxAmount - (discount || 0);

    // 3. Create Record
    const finance = await Finance.create({
      type,
      customId,
      project: projectId,
      client: clientId,
      createdBy: req.user._id,
      lineItems,
      subtotal,
      taxRate,
      taxAmount,
      discount,
      totalAmount,
      issueDate,
      dueDate,
      notes,
      status: 'Pending' // Default status
    });

    res.status(201).json(finance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get all financial records (Filtered by Project, Type, or Client)
// @route   GET /api/finance?clientId=...&type=...
// @access  Private
export const getFinances = async (req, res) => {
  try {
    const { projectId, type, clientId } = req.query; 
    let query = {};

    // Standard Filters
    if (projectId) query.project = projectId;
    if (type) query.type = type;

    // Admin Filter: View finances for a specific client
    if (req.user.role === 'admin' && clientId) {
      query.client = clientId;
    }

    // Role Security: Clients can ONLY see their own finances
    if (req.user.role === 'client') {
      query.client = req.user._id; 
    }

    const finances = await Finance.find(query)
      .populate('client', 'name email address')
      .populate('project', 'name projectNo')
      .sort({ createdAt: -1 });

    res.json(finances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get single finance record details
// @route   GET /api/finance/:id
// @access  Private
export const getFinanceById = async (req, res) => {
  try {
    const finance = await Finance.findById(req.params.id)
      .populate('client', 'name email address phoneNumber')
      .populate('project', 'name description') // 'location' removed from schema earlier
      .populate('createdBy', 'name email');

    if (!finance) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Security Check
    if (req.user.role === 'client' && finance.client._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized' });
    }

    res.json(finance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update Status (e.g. Mark as Paid, Approved)
// @route   PUT /api/finance/:id/status
// @access  Private
export const updateFinanceStatus = async (req, res) => {
  try {
    const { status } = req.body; 
    
    const finance = await Finance.findById(req.params.id);

    if (!finance) {
      return res.status(404).json({ message: 'Record not found' });
    }

    // Security: Only Admin can mark as "Paid"
    if (status === 'Paid' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only Admin can mark invoices as Paid' });
    }

    finance.status = status;
    await finance.save();

    // RECALCULATE PROJECT TOTALS
    // If it's an Invoice, we must ensure the Project's "totalPaid" is accurate.
    // Instead of just adding/subtracting, we aggregate to be safe against double-clicks/logic errors.
    if (finance.type === 'Invoice') {
        const project = await Project.findById(finance.project);
        if (project) {
            const stats = await Finance.aggregate([
                { $match: { project: project._id, type: 'Invoice', status: 'Paid' } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]);
            
            project.totalPaid = stats.length > 0 ? stats[0].total : 0;
            await project.save();
        }
    }

    res.json(finance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update a finance record (Admin only)
// @route   PUT /api/finance/:id
// @access  Private (Admin Only)
export const updateFinance = async (req, res) => {
  try {
    const finance = await Finance.findById(req.params.id);
    if (!finance) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const {
      type,
      projectId,
      clientId,
      lineItems,
      taxRate,
      discount,
      issueDate,
      dueDate,
      notes,
      status,
    } = req.body;

    if (type) finance.type = type;
    if (projectId) finance.project = projectId;
    if (clientId) finance.client = clientId;
    if (lineItems) finance.lineItems = lineItems;
    if (taxRate !== undefined) finance.taxRate = Number(taxRate) || 0;
    if (discount !== undefined) finance.discount = Number(discount) || 0;
    if (issueDate) finance.issueDate = issueDate;
    if (dueDate) finance.dueDate = dueDate;
    if (notes !== undefined) finance.notes = notes;
    if (status) finance.status = status;

    // Recalculate totals
    let subtotal = 0;
    if (Array.isArray(finance.lineItems)) {
      finance.lineItems.forEach((item) => {
        subtotal += (item.quantity || 0) * (item.rate || 0);
      });
    }
    finance.subtotal = subtotal;
    finance.taxAmount = subtotal * ((finance.taxRate || 0) / 100);
    finance.totalAmount = subtotal + finance.taxAmount - (finance.discount || 0);

    await finance.save();

    // Recalculate project totals if invoice status changed
    if (finance.type === 'Invoice' && status) {
      const project = await Project.findById(finance.project);
      if (project) {
        const stats = await Finance.aggregate([
          { $match: { project: project._id, type: 'Invoice', status: 'Paid' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        project.totalPaid = stats.length > 0 ? stats[0].total : 0;
        await project.save();
      }
    }

    res.json(finance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Delete a finance record (Admin only)
// @route   DELETE /api/finance/:id
// @access  Private (Admin Only)
export const deleteFinance = async (req, res) => {
  try {
    const finance = await Finance.findById(req.params.id);
    if (!finance) {
      return res.status(404).json({ message: 'Record not found' });
    }

    const projectId = finance.project;
    const isInvoice = finance.type === 'Invoice';

    await Finance.findByIdAndDelete(req.params.id);

    if (isInvoice && projectId) {
      const project = await Project.findById(projectId);
      if (project) {
        const stats = await Finance.aggregate([
          { $match: { project: project._id, type: 'Invoice', status: 'Paid' } },
          { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);
        project.totalPaid = stats.length > 0 ? stats[0].total : 0;
        await project.save();
      }
    }

    res.json({ message: 'Finance record removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
