const controller = require('../controllers/leaveBalanceController');
const { verifyToken } = require('../middleware/authMiddleware');

module.exports = [
  {
    method: 'GET',
    path: '/api/leave-balances',
    options: {
      pre: [verifyToken]
    },
    handler: controller.getUserLeaveBalances
  },
  {
    method: 'GET',
    path: '/api/leave-balances/{userId}',
    options: {
      pre: [verifyToken]
    },
    handler: controller.getLeaveBalancesByUserId
  }
];
