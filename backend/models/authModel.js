const db = require('./db');

const findUserByEmail = async (email) => {
  const [rows] = await db.query('SELECT id, name, email, password, role, manager_id, hr_id, admin_id, department FROM users WHERE email = ?', [email]);
  return rows[0];
};

const createUser = async (user) => {
  const { name, email, password, role, manager_id, hr_id, admin_id, department } = user;
  const [result] = await db.query(
    'INSERT INTO users (name, email, password, role, manager_id, hr_id, department, admin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [name, email, password, role, manager_id || null, hr_id || null, department, admin_id]
  );
  return result.insertId;
};

const updateUserPassword = async (userId, newPassword) => {
  await db.query('UPDATE users SET password = ? WHERE id = ?', [newPassword, userId]);
};

module.exports = { findUserByEmail, createUser, updateUserPassword };