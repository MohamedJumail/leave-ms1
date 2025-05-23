const leaveTypeModel = require('../models/leaveTypeModel');

const getLeaveTypes = async (request, h) => {
  const types = await leaveTypeModel.getAllLeaveTypes();
  return h.response(types).code(200);
};

const addLeaveType = async (request, h) => {
  const { name, max_days, apply_before_days, carry_forward } = request.payload;

  const id = await leaveTypeModel.createLeaveType({
    name, max_days, apply_before_days, carry_forward
  });

  return h.response({ msg: 'Leave type added', id }).code(201);
};

// 👇 NEW FUNCTION to get leaves and holidays
const getUserLeavesAndHolidays = async (request, h) => {
  try {
    const userId = request.pre.auth.id;

    const leaves = await leaveTypeModel.getApprovedLeavesByUser(userId);
    const holidays = await leaveTypeModel.getAllHolidays();

    return h.response({ leaves, holidays }).code(200);
  } catch (err) {
    console.error(err);
    return h.response({ error: 'Failed to fetch calendar data' }).code(500);
  }
};

module.exports = {
  getLeaveTypes,
  addLeaveType,
  getUserLeavesAndHolidays
};
