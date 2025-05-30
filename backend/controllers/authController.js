const bcrypt = require('bcrypt');
const { findUserByEmail, createUser, updateUserPassword } = require('../models/authModel');
const { getAllLeaveTypes } = require('../models/leaveTypeModel');
const { insertLeaveBalance } = require('../models/leaveBalanceModel');
const { generateToken } = require('../utils/jwt');

// Create leave balance records for user after user is created
const setUserLeaveBalancesForUser = async (userId) => {
  const types = await getAllLeaveTypes();

  for (const type of types) {
    await insertLeaveBalance(userId, type.id, type.max_days);
  }
};

const register = async (request, h) => {
  const { name, email, password, role, manager_id, hr_id, department } = request.payload;

  const existing = await findUserByEmail(email);
  if (existing) return h.response({ msg: 'Email already registered' }).code(400);

  const hashedPassword = await bcrypt.hash(password, 10);

  const userId = await createUser({
    name,
    email,
    password: hashedPassword,
    role,
    manager_id,
    hr_id,
    admin_id : 2,
    department
  });

  await setUserLeaveBalancesForUser(userId);

  return h.response({ msg: 'User created', userId }).code(201);
};
const login = async (request, h) => {
  const { email, password } = request.payload;
  try {
    const user = await findUserByEmail(email);
    if (!user) {
      console.log('User not found:', email); // Log missing user
      return h.response({ success: false, message: 'Invalid email or password' }).code(401);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.log('Invalid password for:', email); // Log failed password check
      return h.response({ success: false, message: 'Invalid email or password' }).code(401);
    }

    const token = generateToken(user);
    const { password: _, ...safeUser } = user;
    return h.response({ 
      success: true,
      token,
      user: safeUser,
      message: 'Login successful'
    }).code(200);

  } catch (err) {
    console.error('Login error:', err); // Log server errors
    return h.response({ 
      success: false,
      message: 'Server error during login' 
    }).code(500);
  }
};
const updatePassword = async (request, h) => {
  const userId = request.auth.id;
  const { newPassword } = request.payload;

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await updateUserPassword(userId, hashedPassword);

  return h.response({ msg: 'Password updated' }).code(200);
};
const getProfile = async (request, h) => {
  const { password, ...safeUser } = request.auth;
  return h.response({ user: safeUser }).code(200);
};

module.exports = { register, login, updatePassword, getProfile };
