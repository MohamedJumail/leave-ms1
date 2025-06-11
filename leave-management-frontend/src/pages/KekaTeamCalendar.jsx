import React, { useState, useEffect, useCallback } from 'react';
import moment from 'moment';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../styles/TeamCalendar.css';

const eventTypeColors = {
  "Holiday": 'rgba(255, 215, 0, 0.6)',
  "Weekly off": 'rgba(75, 75, 75, 0.8)',
  "Casual leave": 'rgba(70, 130, 180, 0.6)',
  "Sick leave": 'rgba(255, 99, 71, 0.6)',
  "Earned leave": 'rgba(138, 43, 226, 0.6)',
  "Default Leave": 'rgba(220, 20, 60, 0.6)',
};

const eventTypeLabels = {
  "Holiday": "Holiday",
  "Weekly off": "Weekly Off",
  "Casual leave": "Casual Leave",
  "Sick leave": "Sick Leave",
  "Earned leave": "Earned Leave",
};

const KekaTeamCalendar = () => {
  const { token } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [teamCalendarData, setTeamCalendarData] = useState([]);
  const [globalHolidays, setGlobalHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const month = moment(currentDate).month() + 1;
  const year = moment(currentDate).year();

  const fetchTeamCalendarData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/team-calendar?month=${month}&year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = res.data;

      const processed = data.teamCalendarData.map(member => {
        const dayMap = {};
        let hasEvents = false;
        member.events.forEach((eventData, index) => {
          const day = index + 1;
          if (eventData) {
            dayMap[day] = { type: eventData.type };
            if (eventData.type !== 'Weekly off') hasEvents = true;
          }
        });
        return {
          id: member.id,
          name: member.name,
          events: dayMap,
          hasActualEventsInMonth: hasEvents
        };
      }).filter(m => m.hasActualEventsInMonth);

      setTeamCalendarData(processed);
      setGlobalHolidays(data.holidays || []);
    } catch (err) {
      setError("Failed to load team calendar. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token, month, year]);

  useEffect(() => {
    fetchTeamCalendarData();
  }, [fetchTeamCalendarData]);

  const handleMonthChange = (dir) => {
    const newDate = moment(currentDate).add(dir === 'next' ? 1 : -1, 'month').toDate();
    setCurrentDate(newDate);
  };

  const numDaysInMonth = moment(`${year}-${month}`, 'YYYY-MM').daysInMonth();
  const daysArray = Array.from({ length: numDaysInMonth }, (_, i) => i + 1);
  const getDayOfWeek = (d) => moment(`${year}-${month}-${d}`, 'YYYY-MM-DD').format('dd');
  const isWeekend = (d) => [0, 6].includes(moment(`${year}-${month}-${d}`).day());
  const getHolidayName = (d) => {
    const dateStr = moment(`${year}-${month}-${d}`).format('YYYY-MM-DD');
    const holiday = globalHolidays.find(h => moment(h.date).format('YYYY-MM-DD') === dateStr);
    return holiday?.name || null;
  };

  const getCellType = (member, day) => {
    const holiday = getHolidayName(day);
    if (holiday) return 'Holiday';
    if (isWeekend(day)) return 'Weekly off';
    return member.events[day]?.type || null;
  };

  if (loading) return <div className="calendar-message">Loading team calendar...</div>;
  if (error) return <div className="calendar-message calendar-error">{error}</div>;

  return (
    <div className="keka-team-calendar-container">
      <div className="team-calendar-navigation">
        <button onClick={() => handleMonthChange('prev')}>&lt; Prev</button>
        <span>{moment(currentDate).format('MMMM YYYY')}</span>
        <button onClick={() => handleMonthChange('next')}>Next &gt;</button>
      </div>

      <div className="calendar-scroll-wrapper">
        <div className="calendar-content-wrapper">
          <div className="keka-calendar-header">
            <div className="keka-empty-cell">Team Member</div>
            {daysArray.map(day => (
              <div key={`day-${day}`} className="keka-day-cell">
                <div className="day-of-week">{getDayOfWeek(day)}</div>
              </div>
            ))}
          </div>

          <div className="keka-calendar-body">
            {teamCalendarData.length === 0 ? (
              <div className="calendar-message-inline">No team members with events found for this month.</div>
            ) : teamCalendarData.map(member => (
              <div key={member.id} className="keka-member-row">
                <div className="keka-member-name">{member.name}</div>
                {daysArray.map(day => {
                  const cellType = getCellType(member, day);
                  const tooltip = cellType === 'Holiday'
                    ? `Holiday: ${getHolidayName(day)}`
                    : cellType === 'Weekly off'
                    ? 'Weekly Off'
                    : cellType
                    ? `${member.name} - ${eventTypeLabels[cellType] || cellType}`
                    : '';

                  const color = eventTypeColors[cellType] || null;

                  const prevType = getCellType(member, day - 1);
                  const nextType = getCellType(member, day + 1);

                  let blockClass = '';
                  if (cellType && prevType !== cellType && nextType === cellType) blockClass = 'continuous-start';
                  else if (cellType && prevType === cellType && nextType !== cellType) blockClass = 'continuous-end';
                  else if (cellType && prevType === cellType && nextType === cellType) blockClass = 'continuous-mid';
                  else if (cellType) blockClass = 'single-day-event';

                  return (
                    <div
                      key={`${member.id}-${day}`}
                      className={`keka-day-cell member-day-cell`}
                      title={tooltip}
                    >
                      {cellType ? (
                        <div className={`event-block-wrapper ${blockClass}`} style={{ backgroundColor: color }}>
                          <span className="day-number-inside">{day}</span>
                        </div>
                      ) : (
                        <div className="empty-day-number">{day}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="keka-legend">
        {Object.entries(eventTypeLabels).map(([key, label]) => (
          <div key={key} className="legend-item">
            <span className="legend-color-box" style={{ backgroundColor: eventTypeColors[key] }}></span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};

export default KekaTeamCalendar;
