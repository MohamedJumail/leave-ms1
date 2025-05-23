const db = require('./db');

// Set or update balance for a specific user and leave type
const insertLeaveBalance = async (userId, leaveTypeId, balance) => {
  await db.query(
    `INSERT INTO leave_balances (user_id, leave_type_id, balance)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE balance = VALUES(balance)`,
    [userId, leaveTypeId, balance]
  );
};

// Get all leave balances for a user
const getUserLeaveBalances = async (userId) => {
  console.log('Fetching leave balances for user_id:', userId);

  const [rows] = await db.query(`
    SELECT lb.*, lt.name as leave_type
    FROM leave_balances lb
    JOIN leave_types lt ON lb.leave_type_id = lt.id
    WHERE lb.user_id = ?
  `, [userId]);

  console.log('Resulting balances:', rows);

  return rows;
};

module.exports = {
  insertLeaveBalance,
  getUserLeaveBalances
};

