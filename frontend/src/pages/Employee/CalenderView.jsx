import React, { useEffect, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './CalenderView.css'
const localizer = momentLocalizer(moment);

// Define colors for each leave type
const leaveTypeColors = {
  "Sick leave": '#FF6347',       // Tomato red
  "Casual leave": '#4682B4',     // Steel blue
  "Default": '#FF0000',          // Red fallback
};

function MyCalendar() {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await api.get('/api/calendar', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = res.data;

        let allDates = [];

        data.holidays.forEach(h => allDates.push(new Date(h.date)));
        data.leaves.forEach(l => {
          allDates.push(new Date(l.start_date || l.startDate));
          allDates.push(new Date(l.end_date || l.endDate));
        });

        const minDate = allDates.length
          ? new Date(Math.min(...allDates))
          : moment().startOf('month').toDate();

        const maxDate = allDates.length
          ? new Date(Math.max(...allDates))
          : moment().endOf('month').toDate();

        const extendedMinDate = moment(minDate).subtract(15, 'years').startOf('day');
        const extendedMaxDate = moment(maxDate).add(15, 'years').endOf('day');

        // Generate weekend events for entire extended range
        const weekendEvents = [];
        const currentDate = extendedMinDate.clone();
        const weekendSet = new Set(); // To track weekend dates

        while (currentDate.toDate() <= extendedMaxDate.toDate()) {
          const day = currentDate.day();
          if (day === 0 || day === 6) {
            const dateStr = currentDate.format('YYYY-MM-DD');
            weekendSet.add(dateStr);
            weekendEvents.push({
              title: 'Week Off',
              start: currentDate.toDate(),
              end: currentDate.toDate(),
              allDay: true,
              type: 'weekend',
            });
          }
          currentDate.add(1, 'day');
        }

        // Holiday events
        const holidaysEvents = data.holidays.map(holiday => ({
          title: holiday.name || 'Holiday',
          start: new Date(holiday.date),
          end: new Date(holiday.date),
          allDay: true,
          type: 'holiday',
        }));

        // Leave events (excluding weekends)
        const leavesEvents = [];

        data.leaves.forEach(leave => {
          const startDate = moment(leave.start_date || leave.startDate);
          const endDate = moment(leave.end_date || leave.endDate);
          const leaveType = leave.leave_type || leave.type || 'Default';

          let current = startDate.clone();
          while (current.isSameOrBefore(endDate, 'day')) {
            const dateStr = current.format('YYYY-MM-DD');
            if (!weekendSet.has(dateStr)) {
              leavesEvents.push({
                title: `Leave: ${leaveType}`,
                start: current.toDate(),
                end: current.toDate(),
                allDay: true,
                type: 'leave',
                leaveType,
              });
            }
            current.add(1, 'day');
          }
        });

        setEvents([...weekendEvents, ...holidaysEvents, ...leavesEvents]);
      } catch (error) {
        console.error('Error fetching calendar data:', error);
      }
    }

    if (token) {
      fetchEvents();
    }
  }, [token]);

  return (
    <div style={{ height: 600 }}>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 550 }}
        eventPropGetter={(event) => {
          let style = {};
          if (event.type === 'holiday') {
            style = {
              backgroundColor: '#1DA1F2',
              color: 'black',
              borderRadius: '5px',
              border: '1px solid #000080',
              padding: '2px',
            };
          } else if (event.type === 'leave') {
            style = {
              backgroundColor: leaveTypeColors[event.leaveType] || leaveTypeColors.Default,
              color: 'white',
              borderRadius: '5px',
              border: '1px solid darkred',
              padding: '2px',
            };
          } else if (event.type === 'weekend') {
            style = {
              backgroundColor: 'silver',
              color: 'black',
              fontWeight: 'bold',
              borderRadius: '5px',
              border: '1px solid #ccc',
              padding: '2px',
            };
          }
          return { style };
        }}
      />
    </div>
  );
}

export default MyCalendar;
