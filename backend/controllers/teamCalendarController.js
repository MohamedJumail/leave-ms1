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

    // Determine team members based on user role
    if (currentUser.role === "HR") {
      teamMembers = await userModel.getAllUsers();
    } else if (currentUser.role === "Manager") {
      teamMembers = await userModel.getTeamMembersByManager(userId);
    } else { // Regular employee role
      if (!currentUser.manager_id) {
        teamMembers = [{ id: currentUser.id, name: currentUser.name }];
      } else {
        // Get team members for the manager, and ensure the current user is included
        teamMembers = await userModel.getTeamMembersByManager(currentUser.manager_id);
        if (!teamMembers.some(m => m.id === currentUser.id)) {
          teamMembers.push({ id: currentUser.id, name: currentUser.name });
        }
      }
    }

    const teamIds = teamMembers.map(u => u.id);

    const allTeamLeaves = await teamCalendarModel.getAllTeamEvents(teamIds, month, year);
    // Filter holidays for the specific month/year at the backend
    const holidayData = (await teamCalendarModel.getHolidays(month, year))
        .filter(holiday => moment(holiday.date).month() + 1 === parseInt(month) && moment(holiday.date).year() === parseInt(year));

    const numDaysInMonth = moment(`${year}-${month}`, 'YYYY-MM').daysInMonth();

    // Map team members to their calendar data, populating events array
    const initialTeamCalendarData = teamMembers.map(member => {
      const memberEvents = {
        id: member.id,
        name: member.name,
        // Using `numDaysInMonth + 1` for 1-based indexing for days, then adjust to 0-based for access
        events: Array(numDaysInMonth).fill(null)
      };

      allTeamLeaves.forEach(event => {
        if (event.user_id === member.id) {
          const start = moment(event.start_date);
          const end = moment(event.end_date);
          let current = start.clone();

          // Iterate over the range of leave dates
          while (current.isSameOrBefore(end, 'day')) {
            // Check if the current day falls within the requested month and year
            if (current.month() + 1 === parseInt(month) && current.year() === parseInt(year)) {
              const dayOfMonth = current.date(); // 1-indexed day of the month
              // Store the event at the 0-indexed position in the array
              if (dayOfMonth > 0 && dayOfMonth <= numDaysInMonth) { // Ensure it's a valid day
                 memberEvents.events[dayOfMonth - 1] = { // Adjust to 0-indexed for array
                  type: event.leave_type_name,
                  id: event.id
                };
              }
            }
            current.add(1, 'day'); // Move to the next day
          }
        }
      });
      return memberEvents;
    });

    // --- CRUCIAL CHANGE: Filter out team members who have no events (all nulls) ---
    const filteredTeamCalendarData = initialTeamCalendarData.filter(member => {
      // Use .some() to check if at least one event in the array is NOT null
      return member.events.some(event => event !== null);
    });

    // Update teamSize to reflect the number of filtered members
    const finalTeamSize = filteredTeamCalendarData.length;

    return h.response({
      month,
      year,
      teamSize: finalTeamSize, // Use the updated teamSize
      teamCalendarData: filteredTeamCalendarData, // Use the filtered data
      holidays: holidayData,
    }).code(200);

  } catch (err) {
    console.error("Error in getTeamCalendar:", err);
    return h.response({ msg: "Failed to fetch team calendar" }).code(500);
  }
};

module.exports = { getTeamCalendar };