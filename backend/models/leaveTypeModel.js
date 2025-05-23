const db = require('./db');

const getAllLeaveTypes = async () => {
  const [rows] = await db.query('SELECT * FROM leave_types');
  return rows;
};

const createLeaveType = async (data) => {
  const { name, max_days, apply_before_days, carry_forward } = data;
  const [result] = await db.query(
    'INSERT INTO leave_types (name, max_days, apply_before_days, carry_forward) VALUES (?, ?, ?, ?)',
    [name, max_days, apply_before_days, carry_forward]
  );
  return result.insertId;
};

// 👇 NEW: Get approved leaves of logged-in user
const getApprovedLeavesByUser = async (userId) => {
  const [rows] = await db.query(`
    SELECT lr.start_date, lr.end_date, lt.name AS leave_type
    FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    WHERE lr.user_id = ? AND lr.status = 'Approved'
  `, [userId]);

  return rows;
};

// 👇 NEW: Get all holidays
const getAllHolidays = async () => {
  const [rows] = await db.query('SELECT name, date FROM holidays');
  return rows;
};

module.exports = {
  getAllLeaveTypes,
  createLeaveType,
  getApprovedLeavesByUser,
  getAllHolidays
};
