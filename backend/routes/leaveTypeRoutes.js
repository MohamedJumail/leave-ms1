const controller = require('../controllers/leaveTypeController');
const { verifyToken, roleCheck } = require('../middleware/authMiddleware');

module.exports = [
  // LEAVE TYPES
  {
    method: 'GET',
    path: '/api/leave-types',
    options: {
      pre: [verifyToken]
    },
    handler: controller.getLeaveTypes
  },
  {
    method: 'POST',
    path: '/api/leave-types',
    options: {
      pre: [verifyToken, roleCheck(['Admin'])]
    },
    handler: controller.addLeaveType
  },

  // LEAVE CALENDAR (APPROVED LEAVES + HOLIDAYS)
  {
    method: 'GET',
    path: '/api/calendar',
    options: {
      pre: [verifyToken]
    },
    handler: controller.getUserLeavesAndHolidays
  }
];
