const db = require("./db");
const bcrypt = require("bcrypt");

// ✅ Fetch a user with limited public profile fields
const getUserById = async (id) => {
  const [rows] = await db.query(
    `SELECT id, name, email, role, manager_id, hr_id, department
     FROM users WHERE id = ?`,
    [id]
  );
  return rows[0];
};

// ✅ Fetch complete user object (for internal permission checks)
const getFullUserById = async (id) => {
  const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0];
};

// ✅ Update user (name and/or password)
const updateUser = async (id, name, password) => {
  let query = "UPDATE users SET ";
  const values = [];

  if (name) {
    query += "name = ?, ";
    values.push(name);
  }

  if (password) {
    const hashedPassword = await bcrypt.hash(password, 10);
    query += "password = ?, ";
    values.push(hashedPassword);
  }

  if (values.length === 0) return; // Nothing to update

  query = query.slice(0, -2); // Remove last comma
  query += " WHERE id = ?";
  values.push(id);

  await db.query(query, values);
};

// ✅ Get list of all users with basic info (admin only)
const getAllUsers = async () => {
  const [rows] = await db.query(
    `SELECT id, name, email, role, manager_id, hr_id, department
     FROM users`
  );
  return rows;
};
const deleteUserById = async (id) => {
  const [result] = await db.query("DELETE FROM users WHERE id = ?", [id]);
  return result.affectedRows > 0;
};

const updatePassword = async (id, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.query("UPDATE users SET password = ? WHERE id = ?", [
    hashedPassword,
    id,
  ]);
};

const getUserWithPassword = async (id) => {
  const [rows] = await db.query(`SELECT id, password FROM users WHERE id = ?`, [
    id,
  ]);
  return rows[0];
};
const adminUpdateUserDetails = async (id, updates) => {
  const fields = [];
  const values = [];

  for (const key in updates) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return false;

  const query = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
  values.push(id);

  const [result] = await db.query(query, values);
  return result.affectedRows > 0;
};
// In your userModel (keep existing methods)
const getTeamMembersByManager = async (managerId) => {
  const [rows] = await db.query(
    `SELECT id, name, email, role, department 
     FROM users 
     WHERE manager_id = ?`,
    [managerId]
  );
  return rows;
};
const getTeamMembersByHR = async (hrId) => {
  const [rows] = await db.query(
    `SELECT id, name, email, role, department 
     FROM users 
     WHERE hr_id = ?`,
    [hrId]
  );
  return rows;
};

const isUserOnLeave = async (userId, date) => {
  const [rows] = await db.query(
    `SELECT 1 FROM leave_requests 
WHERE user_id = ? 
AND ? BETWEEN start_date AND end_date
AND status = 'Approved'
AND user_status != 'Cancelled'`,
    [userId, date]
  );
  return rows.length > 0;
};
module.exports = {
  getUserById,
  getFullUserById,
  updateUser,
  getAllUsers,
  updatePassword,
  getUserWithPassword,
  deleteUserById,
  adminUpdateUserDetails,
  getTeamMembersByManager,
  isUserOnLeave,
  getTeamMembersByHR
};
