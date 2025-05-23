const leaveBalanceModel = require('../models/leaveBalanceModel');

// Existing method using token user ID
const getUserLeaveBalances = async (request, h) => {
  const userId = request.pre.auth.id;
  const balances = await leaveBalanceModel.getUserLeaveBalances(userId);
  return h.response(balances).code(200);
};

// New method using userId from URL parameter
const getLeaveBalancesByUserId = async (request, h) => {
  const userId = request.params.userId;

  // Optional: Add validation here for userId format, e.g. number check

  const balances = await leaveBalanceModel.getUserLeaveBalances(userId);
  return h.response(balances).code(200);
};

module.exports = {
  getUserLeaveBalances,
  getLeaveBalancesByUserId
};
