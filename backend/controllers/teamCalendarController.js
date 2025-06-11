const teamCalendarModel = require('../models/teamCalendarModel');
const userModel = require('../models/userModel');
const moment = require('moment');

const getTeamCalendar = async (request, h) => {
  try {
    const userId = request.pre.auth.id;
    const { month, year } = request.query;

    if (!month || !year) {
      return h.response({ msg: "Month and year are required" }).code(400);
    }

    const currentUser = await userModel.getFullUserById(userId);
    if (!currentUser) return h.response({ msg: "User not found" }).code(404);

    let teamMembers = [];

    if (currentUser.role === "HR") {
      teamMembers = await userModel.getAllUsers();
    } else if (currentUser.role === "Manager") {
      teamMembers = await userModel.getTeamMembersByManager(userId);
    } else {
      if (!currentUser.manager_id) {
        return h.response({
          month,
          year,
          teamSize: 0,
          teamCalendarData: [],
          holidays: await teamCalendarModel.getHolidays(month, year),
        }).code(200);
      }
      teamMembers = await userModel.getTeamMembersByManager(currentUser.manager_id);
      if (!teamMembers.some(m => m.id === currentUser.id)) {
        teamMembers.push({ id: currentUser.id, name: currentUser.name });
      }
    }

    const teamIds = teamMembers.map(u => u.id);

    const allTeamLeaves = await teamCalendarModel.getAllTeamEvents(teamIds, month, year);
    const holidayData = await teamCalendarModel.getHolidays(month, year);

    const numDaysInMonth = moment(`${year}-${month}`, 'YYYY-MM').daysInMonth();
    const teamCalendarData = teamMembers.map(member => {
      const memberEvents = {
        id: member.id,
        name: member.name,
        events: Array(numDaysInMonth + 1).fill(null)
      };

      allTeamLeaves.forEach(event => {
        if (event.user_id === member.id) {
          const start = moment(event.start_date);
          const end = moment(event.end_date);
          let current = start.clone();
          while (current.isSameOrBefore(end, 'day')) {
            if (current.month() + 1 === parseInt(month) && current.year() === parseInt(year)) {
              const dayOfMonth = current.date();
              memberEvents.events[dayOfMonth] = {
                type: event.leave_type_name,
                id: event.id
              };
            }
            current.add(1, 'day');
          }
        }
      });

      return memberEvents;
    });

    return h.response({
      month,
      year,
      teamSize: teamIds.length,
      teamCalendarData,
      holidays: holidayData,
    });

  } catch (err) {
    console.error("Error in getTeamCalendar:", err);
    return h.response({ msg: "Failed to fetch team calendar" }).code(500);
  }
};

module.exports = { getTeamCalendar };