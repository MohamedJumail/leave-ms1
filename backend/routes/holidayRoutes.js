const HolidayController = require('../controllers/holidayController');
const { verifyToken, checkRole, roleCheck } = require('../middleware/authMiddleware');

module.exports = [
  {
    method: 'POST',
    path: '/holidays',
    handler: HolidayController.add,
    options: {
      pre: [verifyToken, roleCheck(['Admin'])],
    },
  },
  {
    method: 'GET',
    path: '/holidays',
    handler: HolidayController.list,
    options: {
      pre: [verifyToken],
    },
  },
  {
    method: 'DELETE',
    path: '/holidays/{id}',
    handler: HolidayController.delete,
    options: {
      pre: [verifyToken, roleCheck(['Admin'])],
    },
  }
];
