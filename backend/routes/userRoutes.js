const userController = require("../controllers/userController");
const { verifyToken, roleCheck } = require("../middleware/authMiddleware");

module.exports = [
  {
    method: "GET",
    path: "/api/users/profile",
    handler: userController.getOwnProfile,
    options: { pre: [verifyToken] },
  },
  {
    method: "PUT",
    path: "/api/users/update-profile",
    handler: userController.updateOwnProfile,
    options: { pre: [verifyToken] },
  },
  {
    method: "GET",
    path: "/api/users/:id",
    handler: userController.getUserById,
    options: { pre: [verifyToken] },
  },
  {
    method: "GET",
    path: "/api/users",
    handler: userController.getAllUsers,
    options: { pre: [verifyToken, roleCheck(["Admin", "Manager", "HR"])] },
  },
  {
    method: "DELETE",
    path: "/api/users/{id}",
    handler: userController.deleteUserById,
    options: { pre: [verifyToken, roleCheck(["Admin"])] },
  },
  {
    method: "PUT",
    path: "/api/users/change-password",
    handler: userController.changePassword,
    options: { pre: [verifyToken] },
  },
  {
    method: "PUT",
    path: "/api/users/{id}",
    handler: userController.adminUpdateUser,
    options: { pre: [verifyToken, roleCheck(["Admin"])] },
  },
  // In your routes file
  {
    method: "GET",
    path: "/api/team-leave-status",
    handler: userController.getTeamLeaveStatus,
    options: { pre: [verifyToken] },
  },
];
