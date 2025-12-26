import User from '../model/User.js';
import { Project } from '../model/Project.js';
import { Finance } from '../model/Finance.js';
import { Message } from '../model/Message.js';
import { Task } from '../model/Task.js';

// @route   GET /api/admin/stats
// @desc    Get top cards (Revenue, Clients, etc.), Project Status, and Pending Actions
export const getDashboardStats = async (req, res) => {
  try {
    const totalClients = await User.countDocuments({ role: 'client' });
    const totalProjects = await Project.countDocuments();
    const totalInvoices = await Finance.countDocuments({ type: 'Invoice' });

    // 1. Revenue Calculation (Paid Invoices)
    const revenueResult = await Finance.aggregate([
      { $match: { type: 'Invoice', status: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // 2. Sales Calculation (All Invoices Created)
    const salesResult = await Finance.aggregate([
      { $match: { type: 'Invoice' } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);
    const totalSales = salesResult.length > 0 ? salesResult[0].total : 0;

    // 3. Project Status Breakdown (For Donut Chart)
    const projectStatusRaw = await Project.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const projectStatus = {
      Completed: 0,
      Active: 0,
      Pending: 0,
      OnHold: 0,
      Archived: 0
    };

    projectStatusRaw.forEach(item => {
      const statusKey = item._id.replace(/\s+/g, ''); 
      if (projectStatus[statusKey] !== undefined) {
        projectStatus[statusKey] = item.count;
      } else {
        projectStatus[item._id] = item.count; 
      }
    });

    // 4. Pending Actions (Things Admin needs to do)
    // Count Tasks submitted by team members waiting for review
    const pendingTaskReviews = await Task.countDocuments({ status: 'Waiting for Approval' });

    res.json({
      totalClients,
      totalProjects,
      totalInvoices,
      totalRevenue,
      totalSales,
      projectStatus,
      pendingActions: {
        taskReviews: pendingTaskReviews
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/admin/financial-chart
// @desc    Get Monthly Paid vs Unpaid data for the bar chart
export const getFinancialChartData = async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year ? parseInt(year) : new Date().getFullYear();

    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const data = await Finance.aggregate([
      {
        $match: {
          type: 'Invoice',
          issueDate: { $gte: startOfYear, $lte: endOfYear }
        }
      },
      {
        $group: {
          _id: { $month: '$issueDate' },
          paid: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Paid'] }, '$totalAmount', 0]
            }
          },
          unpaid: {
            $sum: {
              $cond: [{ $ne: ['$status', 'Paid'] }, '$totalAmount', 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing months with 0
    const chartData = Array(12).fill(0).map((_, index) => {
      const monthData = data.find(item => item._id === (index + 1));
      return {
        month: index + 1, // 1 = Jan, 12 = Dec
        paid: monthData ? monthData.paid : 0,
        unpaid: monthData ? monthData.unpaid : 0
      };
    });

    res.json(chartData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/admin/message-activity
// @desc    Get message volume over the last 7 days for the line graph
export const getMessageActivity = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const data = await Message.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } 
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/admin/agenda
// @desc    Get Tasks and Projects for the calendar view
export const getAdminAgenda = async (req, res) => {
  try {
    const { month, year } = req.query;
    const date = new Date();
    const currentMonth = month ? parseInt(month) - 1 : date.getMonth();
    const currentYear = year ? parseInt(year) : date.getFullYear();

    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    // Fetch Tasks within this month
    const tasks = await Task.find({
      $or: [
        { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { endDate: { $gte: startOfMonth, $lte: endOfMonth } }
      ]
    }).populate('project', 'name').select('name startDate endDate status project priority');

    // Fetch Projects starting/ending this month
    const projects = await Project.find({
      $or: [
        { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
        { endDate: { $gte: startOfMonth, $lte: endOfMonth } }
      ]
    }).select('name startDate endDate status');

    res.json({ tasks, projects });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};