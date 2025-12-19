import { Project } from '../model/Project.js';
import { Document } from '../model/Document.js';
import { Finance } from '../model/Finance.js';
import { Message } from '../model/Message.js';
import { Notification } from '../model/Notification.js';
import User from '../model/User.js';

// @desc    Get Client Homepage Data (Dashboard)
export const getClientDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const activeProjectsCount = await Project.countDocuments({ client: userId, status: 'Active' });
    const pendingProjectsCount = await Project.countDocuments({ client: userId, status: 'Pending' });

    const projectsRaw = await Project.find({ client: userId })
      .populate('teamMembers.user', 'name avatar')
      .sort({ endDate: 1 });

    const projects = projectsRaw.map(p => {
      const totalMilestones = p.milestones.length || 1;
      const completedMilestones = p.milestones.filter(m => m.status === 'Completed').length;
      let currentStep = completedMilestones + 1;
      if (currentStep > 4) currentStep = 4;

      return {
        _id: p._id,
        name: p.name,
        description: p.description,
        status: p.status,
        deadline: p.endDate,
        coverImage: p.coverImage?.url || '',
        milestoneCurrentStep: currentStep,
        milestoneLabel: `${completedMilestones}/${totalMilestones}`,
        teamAvatars: p.teamMembers.map(tm => tm.user?.avatar).filter(Boolean).slice(0, 3)
      };
    });

    const projectIds = projectsRaw.map(p => p._id);

    // Filter Recent Activity to hide internal drafts
    const newDocs = await Document.find({ 
      project: { $in: projectIds },
      $or: [
        { type: 'Deliverable' }, // Final milestone docs uploaded by Admin
        { status: { $in: ['Approved', 'Review', 'Pending', 'Revision Requested'] } }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('uploadedBy', 'name');

    const pendingApprovals = await Document.find({ 
      project: { $in: projectIds },
      status: { $in: ['Pending', 'Review'] }
    })
    .sort({ createdAt: -1 })
    .limit(3);

    const recentMessages = await Message.find({ 
       sender: { $ne: userId }
    })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('sender', 'name');

    let activityFeed = [];

    newDocs.forEach(doc => {
      activityFeed.push({
        type: 'document', 
        text: `New document: ${doc.name}`,
        subText: doc.uploadedBy ? `By ${doc.uploadedBy.name}` : '',
        time: doc.createdAt,
        id: doc._id,
        link: `/documents/${doc._id}`
      });
    });

    pendingApprovals.forEach(doc => {
      activityFeed.push({
        type: 'approval', 
        text: `Approval required: ${doc.name}`,
        subText: 'Action needed',
        time: doc.updatedAt || doc.createdAt,
        id: doc._id,
        link: `/approvals`
      });
    });

    recentMessages.forEach(msg => {
      activityFeed.push({
        type: 'message', 
        text: `New message from ${msg.sender ? msg.sender.name : 'Team'}`,
        subText: msg.content.substring(0, 30) + '...',
        time: msg.createdAt,
        id: msg._id,
        link: `/messages`
      });
    });

    activityFeed.sort((a, b) => new Date(b.time) - new Date(a.time));

    res.json({
      userName: req.user.name,
      stats: {
        active: activeProjectsCount,
        pending: pendingProjectsCount
      },
      projects,
      recentActivity: activityFeed.slice(0, 5)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get All Client Documents (Quick Action) - FILTERED
export const getClientDocuments = async (req, res) => {
  try {
    const userId = req.user._id;
    // We don't necessarily need category from req.query to filter DB, 
    // we can return all valid docs and let frontend filter tabs.
    
    const projects = await Project.find({ client: userId }).select('_id milestones');
    const projectIds = projects.map(p => p._id);

    // Build Query: Only specific statuses or types (Hiding 'Waiting for Approval')
    let query = { 
      project: { $in: projectIds },
      $or: [
        { type: 'Deliverable' }, 
        { status: { $in: ['Approved', 'Review', 'Pending', 'Revision Requested', 'Rejected'] } } 
      ]
    };

    const documents = await Document.find(query)
      .populate('project', 'name') 
      .populate('uploadedBy', 'name') 
      .sort({ createdAt: -1 });

    const formattedDocs = documents.map(doc => {
      const projectRef = projects.find(p => p._id.toString() === doc.project._id.toString());
      const milestone = projectRef ? projectRef.milestones.id(doc.milestoneId) : null;

      return {
        _id: doc._id,
        name: doc.name,
        projectName: doc.project.name,
        milestoneName: milestone ? milestone.name : 'General', 
        type: doc.type, 
        size: doc.file.size,
        url: doc.file.url,
        uploadedBy: doc.uploadedBy ? doc.uploadedBy.name : 'Unknown',
        uploadedDate: doc.createdAt,
        status: doc.status, 
        commentsCount: doc.comments.length
      };
    });

    res.json(formattedDocs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add Comment to Document
export const addDocumentComment = async (req, res) => {
    try {
        const { text } = req.body;
        const document = await Document.findById(req.params.id);
        if (!document) return res.status(404).json({ message: 'Document not found' });
        
        // Ensure user is authorized (Client owning the project)
        // (Assuming basic protection is done, but deeper check is good)
        const project = await Project.findById(document.project);
        if (project.client.toString() !== req.user._id.toString()) {
             return res.status(403).json({ message: 'Not authorized' });
        }

        document.comments.push({ user: req.user._id, text, createdAt: new Date() });
        await document.save();
        res.json(document.comments[document.comments.length - 1]);
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
};

// @desc    Get Client Finances
export const getClientFinance = async (req, res) => {
    try {
        const userId = req.user._id;
        const projects = await Project.find({ client: userId });
        const totalBudget = projects.reduce((acc, proj) => acc + (proj.budget || 0), 0);
    
        const invoices = await Finance.find({ client: userId, type: 'Invoice' })
          .populate('project', 'name')
          .sort({ issueDate: -1 });
    
        const totalPaid = invoices.filter(inv => inv.status === 'Paid').reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
        const totalUnpaid = invoices.filter(inv => inv.status !== 'Paid').reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    
        const formattedInvoices = invoices.map(inv => ({
          _id: inv._id,
          customId: inv.customId,
          projectName: inv.project ? inv.project.name : 'Unknown',
          status: inv.status,
          amount: inv.totalAmount,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          description: inv.notes || 'Project Fee',
          downloadUrl: `/api/finance/${inv._id}/download`
        }));
    
        res.json({ widgets: { totalBudget, totalPaid, totalUnpaid }, invoices: formattedInvoices });
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
};

// @desc    Get Client Approvals
export const getClientApprovals = async (req, res) => {
    try {
        const userId = req.user._id;
        const projects = await Project.find({ client: userId }).select('_id');
        const projectIds = projects.map(p => p._id);
    
        const documents = await Document.find({
          project: { $in: projectIds },
          status: { $in: ['Pending', 'Review', 'Approved', 'Rejected', 'Revision Requested'] }
        })
        .populate('project', 'name')
        .populate('uploadedBy', 'name role')
        .sort({ createdAt: -1 });
    
        const formattedApprovals = documents.map(doc => ({
          _id: doc._id,
          title: doc.name,
          projectName: doc.project.name,
          description: doc.notes || 'Please review...',
          requestedBy: doc.uploadedBy ? `${doc.uploadedBy.name} (${doc.uploadedBy.role})` : 'System',
          requestedDate: doc.createdAt,
          dueDate: doc.createdAt,
          status: doc.status
        }));
    
        res.json(formattedApprovals);
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
};

// @desc    Process Approval (Approve/Reject/Revision) + NOTIFICATIONS
export const updateApprovalStatus = async (req, res) => {
  try {
    const { status, feedback } = req.body; // status: 'Approved', 'Rejected', 'Revision Requested'
    const documentId = req.params.id;
    const userId = req.user._id;

    const document = await Document.findById(documentId);
    if (!document) return res.status(404).json({ message: 'Document not found' });

    const project = await Project.findById(document.project);
    if (!project || project.client.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    document.status = status;
    if (status === 'Approved') {
      document.approvedBy = userId;
      document.approvedDate = new Date();
    }
    if (feedback) {
      document.comments.push({
        user: userId,
        text: `[${status}] ${feedback}`,
        createdAt: new Date()
      });
    }

    await document.save();

    // NOTIFICATION TRIGGER: Notify ALL Admins
    const admins = await User.find({ role: 'admin' });
    
    // Customize message based on status
    let notifMessage = '';
    if (status === 'Approved') {
        notifMessage = `Client ${req.user.name} APPROVED the document "${document.name}".`;
    } else if (status === 'Revision Requested') {
        notifMessage = `Client ${req.user.name} requested REVISIONS for "${document.name}".`;
    } else {
        notifMessage = `Client ${req.user.name} REJECTED the document "${document.name}".`;
    }

    const notificationPromises = admins.map(admin => 
        Notification.create({
            recipient: admin._id,
            sender: req.user._id,
            type: 'Approval Request', 
            message: notifMessage,
            relatedId: document._id,
            onModel: 'Document'
        })
    );
    await Promise.all(notificationPromises);

    res.json({ message: `Document ${status}`, document });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};