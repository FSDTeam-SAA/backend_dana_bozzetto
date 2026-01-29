import { Project } from '../model/Project.js';
import { Document } from '../model/Document.js';
import { Finance } from '../model/Finance.js';
import { Message } from '../model/Message.js';
import { Chat } from '../model/Chat.js'; 
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
      if (currentStep > totalMilestones) currentStep = totalMilestones; 

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

    // Recent Activity Logic
    const newDocs = await Document.find({ 
      project: { $in: projectIds },
      // Removed strict 'Deliverable' type check here too, looking for milestone-related or specific statuses
      status: { $in: ['Approved', 'Review', 'Revision Requested'] }
    })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('uploadedBy', 'name');

    const pendingApprovals = await Document.find({ 
      project: { $in: projectIds },
      status: 'Review' 
    })
    .sort({ createdAt: -1 })
    .limit(3);

    const userChats = await Chat.find({ users: { $elemMatch: { $eq: userId } } })
      .select('_id')
      .lean();
    
    const chatIds = userChats.map(c => c._id);

    const recentMessages = await Message.find({ 
       chat: { $in: chatIds },
       sender: { $ne: userId } 
    })
    .sort({ createdAt: -1 })
    .limit(3)
    .populate('sender', 'name');

    let activityFeed = [];

    newDocs.forEach(doc => {
      activityFeed.push({
        type: 'document', 
        text: `New deliverable: ${doc.name}`,
        subText: doc.uploadedBy ? `Uploaded by ${doc.uploadedBy.name}` : '',
        time: doc.createdAt,
        id: doc._id,
        link: `/documents` 
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
        text: `Message from ${msg.sender ? msg.sender.name : 'Team'}`,
        subText: msg.content ? (msg.content.substring(0, 30) + (msg.content.length > 30 ? '...' : '')) : 'Sent an attachment',
        time: msg.createdAt,
        id: msg.chat, 
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

// @desc    Get All Client Documents (Filtered by Milestone)
// @route   GET /api/client-portal/documents?milestone=Pre-Design
export const getClientDocuments = async (req, res) => {
  try {
    const userId = req.user._id;
    const { milestone } = req.query; 
    
    const projects = await Project.find({ client: userId });
    const projectIds = projects.map(p => p._id);

    // Query: Any document in these projects (Removed strict 'Deliverable' check)
    // You might want to filter out 'Internal' docs if you have such a type, 
    // but usually clients should see most docs if they are in the project folder.
    let query = { 
      project: { $in: projectIds }
    };

    // If you specifically want ONLY milestone deliverables here:
    // query.milestoneId = { $exists: true };

    if (milestone && milestone !== 'All') {
        let targetMilestoneIds = [];
        projects.forEach(p => {
            const found = p.milestones.find(m => m.name === milestone);
            if (found) targetMilestoneIds.push(found._id);
        });
        query.milestoneId = { $in: targetMilestoneIds };
    }

    const documents = await Document.find(query)
      .populate('project', 'name milestones') 
      .populate('uploadedBy', 'name') 
      .sort({ createdAt: -1 });

    const formattedDocs = documents.map(doc => {
      const milestoneObj = doc.project.milestones.id(doc.milestoneId);
      const sizeInMB = (doc.file.size / (1024 * 1024)).toFixed(2); 

      return {
        _id: doc._id,
        name: doc.name,
        projectName: doc.project.name,
        milestoneName: milestoneObj ? milestoneObj.name : 'General', 
        type: doc.type, 
        size: `${sizeInMB} MB`,
        url: doc.file.url,
        uploadedBy: doc.uploadedBy ? doc.uploadedBy.name : 'System',
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

// @desc    Add Comment to Document (Client Feedback)
export const addDocumentComment = async (req, res) => {
    try {
        const { text } = req.body;
        const document = await Document.findById(req.params.id);
        if (!document) return res.status(404).json({ message: 'Document not found' });
        
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

// @desc    Get Client Finances (List View with Filters)
// @route   GET /api/client-portal/finance?status=Paid
export const getClientFinance = async (req, res) => {
    try {
        const userId = req.user._id;
        const { status } = req.query; 

        let query = { client: userId, type: 'Invoice' };

        if (status && status !== 'All') {
            query.status = status;
        }

        const invoices = await Finance.find(query)
          .populate('project', 'name')
          .sort({ issueDate: -1 });
    
        const allInvoices = await Finance.find({ client: userId, type: 'Invoice' });
        const totalPaid = allInvoices.filter(inv => inv.status === 'Paid').reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
        const totalUnpaid = allInvoices.filter(inv => inv.status !== 'Paid').reduce((acc, inv) => acc + (inv.totalAmount || 0), 0);
    
        const formattedInvoices = invoices.map(inv => ({
          _id: inv._id,
          customId: inv.customId,
          projectName: inv.project ? inv.project.name : 'Unknown',
          status: inv.status,
          amount: inv.totalAmount,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          description: inv.notes || 'Project Fee',
          downloadUrl: inv.file?.url || ''
        }));
    
        res.json({ 
            widgets: { totalPaid, totalUnpaid }, 
            invoices: formattedInvoices 
        });
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
};

// @desc    Get Client Approvals (Filtered)
// @route   GET /api/client-portal/approvals?status=Pending
// --- FIXED: Removed strict 'type: Deliverable' check ---
export const getClientApprovals = async (req, res) => {
    try {
        const userId = req.user._id;
        const { status } = req.query; 

        // 1. Get Projects
        const projects = await Project.find({ client: userId }).select('_id');
        const projectIds = projects.map(p => p._id);
    
        // 2. Base Query
        // FIX: We look for documents that have a milestoneId (meaning they are milestone deliverables)
        // OR rely purely on the status if you want to include all approval items.
        let query = {
          project: { $in: projectIds },
          milestoneId: { $exists: true } // Ensures we only pick up milestone-related documents
        };

        // 3. Apply Status Filter
        if (status && status !== 'All') {
            if (status === 'Pending') query.status = 'Review'; // Client sees "Review" as "Pending Action"
            else query.status = status;
        } else {
             query.status = { $in: ['Review', 'Approved', 'Rejected', 'Revision Requested'] };
        }
    
        const documents = await Document.find(query)
        .populate('project', 'name')
        .populate('uploadedBy', 'name role')
        .sort({ updatedAt: -1 }); 
    
        const formattedApprovals = documents.map(doc => ({
          _id: doc._id,
          title: doc.name,
          projectName: doc.project.name,
          description: doc.notes || 'Deliverable for review.',
          requestedBy: doc.uploadedBy ? `${doc.uploadedBy.name} (${doc.uploadedBy.role})` : 'System',
          requestedDate: doc.createdAt,
          dueDate: doc.approvalDueDate || doc.createdAt,
          status: doc.status,
          fileUrl: doc.file.url
        }));
    
        res.json(formattedApprovals);
      } catch (error) {
        res.status(500).json({ message: 'Server error' });
      }
};

// @desc    Process Approval (Approve/Reject/Revision) + NOTIFICATIONS
export const updateApprovalStatus = async (req, res) => {
  try {
    const { status, feedback } = req.body; 
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

    // NOTIFICATION TRIGGER
    const admins = await User.find({ role: 'admin' });
    
    let notifMessage = '';
    if (status === 'Approved') {
        notifMessage = `Client ${req.user.name} APPROVED the milestone deliverable "${document.name}".`;
    } else if (status === 'Revision Requested') {
        notifMessage = `Client ${req.user.name} requested REVISIONS for "${document.name}".`;
    } else {
        notifMessage = `Client ${req.user.name} REJECTED the deliverable "${document.name}".`;
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

// @route   GET /api/client-portal/search?q=...
export const searchClientGlobal = async (req, res) => {
    try {
      const { q } = req.query;
      const userId = req.user._id;
  
      if (!q) return res.json({ projects: [], documents: [], invoices: [] });
  
      const regex = new RegExp(q, 'i');
  
      // 1. Projects (Owned by Client)
      const projects = await Project.find({
        client: userId,
        name: regex
      }).select('name status coverImage');
  
      // 2. Documents (Deliverables in Client's Projects)
      const userProjects = await Project.find({ client: userId }).select('_id');
      const projectIds = userProjects.map(p => p._id);
      
      const documents = await Document.find({
        project: { $in: projectIds },
        // Removed strict type check to ensure results appear if names match
        name: regex
      }).select('name type file.url');

      // 3. Invoices (Finance)
      const invoices = await Finance.find({
         client: userId,
         $or: [
             { customId: regex }, 
             { notes: regex }     
         ]
      }).populate('project', 'name').select('customId totalAmount status issueDate project');
  
      res.json({ 
          projects: projects.map(p => ({
              _id: p._id,
              name: p.name,
              status: p.status,
              image: p.coverImage?.url
          })), 
          documents,
          invoices
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  };