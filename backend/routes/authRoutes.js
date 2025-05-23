const authController = require('../controllers/authController');
const { verifyToken, roleCheck } = require('../middleware/authMiddleware');

module.exports = [
  {
    method: 'POST',
    path: '/api/login',
    handler: authController.login,
  },
  {
    method: 'POST',
    path: '/api/users',
    handler: authController.register,
    options: {
      pre: [verifyToken, roleCheck(['Admin'])],  
    }
  },
  {
    method: 'PUT',
    path: '/api/update-password',
    handler: authController.updatePassword,
    options: {
      pre: [verifyToken],
    }
  },
  {
    method: 'GET',
    path: '/api/profile',
    handler: authController.getProfile,
    options: {
      pre: [verifyToken],
    }
  }
];
