const leaveController = require('../controllers/leaveRequestController'); // Assuming this is your main leave controller
const { verifyToken, roleCheck } = require('../middleware/authMiddleware'); // Assuming your auth middleware

module.exports = [
  {
    method: 'POST',
    path: '/api/leave/apply',
    handler: leaveController.applyLeave,
    options: {
      pre: [verifyToken, roleCheck(['Employee', 'Manager', 'HR'])]
    }
  },
  {
    method: 'GET',
    path: '/api/leave/my-requests',
    handler: leaveController.getMyLeaveRequests,
    options: {
      pre: [verifyToken]
    }
  },
  {
    method: 'GET',
    path: '/api/leave/all-requests',
    handler: leaveController.getSubordinateLeaveRequests,
    options: {
      pre: [verifyToken, roleCheck(['Manager', 'HR'])]
    }
  },
  {
    method: 'GET',
    path: '/api/leave/admin-requests',
    handler: leaveController.getAdminLeaveRequests,
    options: {
      pre: [verifyToken, roleCheck(['Admin'])]
    }
  },
  {
    method: 'PUT',
    path: '/api/leave/cancel/{leaveId}',
    handler: leaveController.cancelLeaveRequest,
    options: {
      pre: [verifyToken]
    }
  },
  {
    method: 'GET',
    path: '/api/leave/my-requests/status/{status}',
    handler: leaveController.getLeaveRequestsByStatus,
    options: {
      pre: [verifyToken]
    }
  },
  {
    method: 'PUT',
    path: '/api/leave/approve-reject/{leaveId}',
    handler: leaveController.approveOrRejectLeaveRequest,
    options: {
      pre: [verifyToken, roleCheck(['Manager', 'HR', 'Admin'])]
    }
  },
  {
    method: 'GET',
    path: '/api/leave/my-pending-requests/{userId}',
    handler: leaveController.getPendingRequestsByUserId,
    options: {
      pre: [verifyToken, roleCheck(['Manager', 'HR'])]
    }
  },
  {
    method: 'GET',
    path: '/api/leave/admin-view-pending/{userId}',
    handler: leaveController.getAdminPendingRequestsForUser,
    options: {
      pre: [verifyToken, roleCheck(['HR', 'Manager', 'Admin'])]
    }
  },
  // NEW ROUTE: Fetch detailed leave status by leave ID
  {
    method: 'GET',
    path: '/api/leave/status/{leaveId}',
    handler: leaveController.getLeaveStatus, // This will be the new controller function
    options: {
      pre: [verifyToken] // Only authenticated users can view their leave status
    }
  }
];