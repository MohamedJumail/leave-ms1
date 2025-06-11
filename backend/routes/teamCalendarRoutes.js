const { verifyToken } = require('../middleware/authMiddleware');
const teamCalendarController = require('../controllers/teamCalendarController');

module.exports = [
  {
    method: 'GET',
    path: '/api/team-calendar',
    handler: teamCalendarController.getTeamCalendar,
    options: { pre: [verifyToken] },
  }
];