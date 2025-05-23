const {
  getUserById,
  getFullUserById,
  updateUser,
  getAllUsers,
} = require("../models/userModel");
const { deleteUserById: deleteUserByIdModel } = require('../models/userModel');
const bcrypt = require('bcrypt');
const userModel = require('../models/userModel');

const getOwnProfile = async (request, h) => {
  const userId = request.pre.auth.id;
  const user = await getUserById(userId);
  return h.response(user);
};

const updateOwnProfile = async (request, h) => {
  const userId = request.pre.auth.id;
  const { name, password } = request.payload;

  if (!name && !password) {
    return h.response({ msg: "Nothing to update" }).code(400);
  }

  await updateUser(userId, name, password);
  return h.response({ msg: "Profile updated successfully" });
};

const getUserByIdController = async (request, h) => {
  const viewer = request.pre.auth;
  const userId = parseInt(request.params.id);

  if (viewer.id === userId) {
    const user = await getUserById(userId);
    return h.response(user);
  }

  if (viewer.role === "admin") {
    const user = await getUserById(userId);
    return user
      ? h.response(user)
      : h.response({ msg: "User not found" }).code(404);
  }

  const targetUser = await getFullUserById(userId);
  if (!targetUser) return h.response({ msg: "User not found" }).code(404);

  if (
    (viewer.role === "hr" && targetUser.hr_id === viewer.id) ||
    (viewer.role === "manager" && targetUser.manager_id === viewer.id)
  ) {
    const limitedUser = {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      manager_id: targetUser.manager_id,
      hr_id: targetUser.hr_id,
      department: targetUser.department,
    };
    return h.response(limitedUser);
  }

  return h.response({ msg: "Access denied" }).code(403);
};

const getAllUsersController = async (request, h) => {
  const users = await getAllUsers();
  return h.response(users);
};
const deleteUserById = async (request, h) => {
  const userId = parseInt(request.params.id);

  const deleted = await deleteUserByIdModel(userId);
  if (deleted) {
    return h.response({ msg: "User deleted successfully" });
  } else {
    return h.response({ msg: "User not found or already deleted" }).code(404);
  }
};
const changePassword = async (request, h) => {
  const userId = request.pre.auth.id;
  const { currentPassword, newPassword } = request.payload;

  if (!currentPassword || !newPassword) {
    return h.response({ msg: "Current and new passwords are required." }).code(400);
  }

  const user = await userModel.getUserWithPassword(userId);
  if (!user) {
    return h.response({ msg: "User not found." }).code(404);
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return h.response({ msg: "Current password is incorrect." }).code(401);
  }

  await userModel.updatePassword(userId, newPassword);
  return h.response({ msg: "Password updated successfully." }).code(200);
};
const adminUpdateUser = async (request, h) => {
  const userId = parseInt(request.params.id);
  const {
    name,
    email,
    role,
    manager_id,
    hr_id,
    department
  } = request.payload;

  if (!name && !email && !role && !manager_id && !hr_id && !department) {
    return h.response({ msg: 'No fields to update' }).code(400);
  }

  const updated = await userModel.adminUpdateUserDetails(userId, {
    name,
    email,
    role,
    manager_id,
    hr_id,
    department
  });

  if (!updated) {
    return h.response({ msg: 'User not found or update failed' }).code(404);
  }

  return h.response({ msg: 'User updated successfully' });
};

// In your userController
const getTeamLeaveStatus = async (request, h) => {
  try {
    const userId = request.pre.auth.id;
    const today = new Date().toISOString().split('T')[0];

    // Get full user details to check role and manager_id
    const user = await userModel.getFullUserById(userId);
    if (!user) {
      return h.response({ msg: 'User not found' }).code(404);
    }

    let teamMembers = [];

    // Get team members based on role
    if (user.role === 'HR') {
      teamMembers = await userModel.getTeamMembersByHR(user.id);
    } else if (user.role === 'Manager') {
      teamMembers = await userModel.getTeamMembersByManager(user.id);
    } else {
      if (!user.manager_id) {
        return h.response({ msg: 'No manager assigned for this user' }).code(404);
      }
      teamMembers = await userModel.getTeamMembersByManager(user.manager_id);
    }

    // Check leave status for each team member
    const teamLeaveStatus = await Promise.all(
      teamMembers.map(async (member) => {
        const isOnLeave = await userModel.isUserOnLeave(member.id, today);
        return {
          ...member,
          onLeave: isOnLeave,
        };
      })
    );

    return h.response(teamLeaveStatus);
  } catch (err) {
    console.error('Error fetching team leave status:', err);
    return h.response({ msg: 'Failed to fetch team leave status' }).code(500);
  }
};


module.exports = {
  getOwnProfile,
  updateOwnProfile,
  getUserById: getUserByIdController,
  getAllUsers: getAllUsersController,
  changePassword,
  deleteUserById,
  adminUpdateUser,
  getTeamLeaveStatus
};
