const db = require('./db');

const insertLeaveBalance = async (userId, leaveTypeId, balance) => {
  const [result] = await db.query(
    `INSERT INTO leave_balances (user_id, leave_type_id, balance)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE balance = VALUES(balance)`,
    [userId, leaveTypeId, parseFloat(balance)]
  );
  return result.insertId || null;
};

const updateLeaveBalanceAccrual = async (userId, leaveTypeId, accrualAmount) => {
  const [result] = await db.query(
    `UPDATE leave_balances
     SET balance = balance + ?
     WHERE user_id = ? AND leave_type_id = ?`,
    [parseFloat(accrualAmount), userId, leaveTypeId]
  );
  return result.affectedRows > 0;
};

const resetLeaveBalance = async (userId, leaveTypeId, newBalanceValue) => {
  const [result] = await db.query(
    `UPDATE leave_balances
     SET balance = ?
     WHERE user_id = ? AND leave_type_id = ?`,
    [parseFloat(newBalanceValue), userId, leaveTypeId]
  );
  return result.affectedRows > 0;
};

const getAllUsersForLeaveProcessing = async () => {
  const [rows] = await db.query('SELECT id FROM users');
  return rows.map(row => ({ id: row.id }));
};

const getLeaveBalancesForUser = async (userId) => {
  const [rows] = await db.query(
    `SELECT
       lb.id,
       lb.user_id,
       lb.leave_type_id,
       lb.balance,
       lt.carry_forward,
       lt.monthly_accrual,
       lt.name AS leave_type_name
     FROM leave_balances lb
     JOIN leave_types lt ON lb.leave_type_id = lt.id
     WHERE lb.user_id = ?`,
    [userId]
  );
  return rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    leave_type_id: row.leave_type_id,
    balance: parseFloat(row.balance),
    carry_forward: row.carry_forward === 1,
    monthly_accrual: parseFloat(row.monthly_accrual), // Added this line
    leave_type_name: row.leave_type_name,
  }));
};

const getUserLeaveBalances = async (userId) => {
  console.log('Fetching leave balances for user_id:', userId);

  const [rows] = await db.query(`
    SELECT lb.*, lt.name as leave_type, lt.carry_forward
    FROM leave_balances lb
    JOIN leave_types lt ON lb.leave_type_id = lt.id
    WHERE lb.user_id = ?
  `, [userId]);

  const mappedRows = rows.map(row => ({
    ...row,
    balance: parseFloat(row.balance),
    carry_forward: row.carry_forward === 1,
  }));

  console.log('Resulting balances:', mappedRows);
  return mappedRows;
};

module.exports = {
  insertLeaveBalance,
  updateLeaveBalanceAccrual,
  resetLeaveBalance,
  getAllUsersForLeaveProcessing,
  getLeaveBalancesForUser,
  getUserLeaveBalances
};