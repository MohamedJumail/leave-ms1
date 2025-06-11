import React, { useState, useEffect } from 'react';
import moment from 'moment';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../styles/TeamCalendar.css';

const eventTypeColors = {
  // Using solid base colors; opacity will be applied via 'opacity' property in layers
  "Holiday": 'rgba(255, 215, 0, 1)',   // Gold base
  "Weekly off": 'rgba(192, 192, 192, 1)', // Silver base for Weekly Off
  "Casual leave": 'rgba(70, 130, 180, 1)', // Steel Blue base
  "Sick leave": 'rgba(255, 99, 71, 1)',   // Tomato base
  "Work from home": 'rgba(106, 168, 79, 1)', // Olive Green base
};

const KekaTeamCalendar = () => {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(moment());

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Request month + 1 because moment.month() is 0-indexed
        const res = await api.get(`/api/team-calendar?month=${currentMonth.month() + 1}&year=${currentMonth.year()}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // The data received here will already be filtered by the backend
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load calendar data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, currentMonth]); // Re-fetch when token or month changes

  const generateDaysInMonth = () => {
    const daysCount = currentMonth.daysInMonth();
    return Array.from({ length: daysCount }, (_, i) =>
      moment(currentMonth).date(i + 1)
    );
  };

  const getEventLayers = (events, dayIndex) => {
    const layers = [];
    const date = moment(currentMonth).date(dayIndex + 1);

    // --- Determine existence and start/end status of higher-priority events ---
    // Ensure data.holidays is available before trying to find a holiday
    const currentDayHoliday = data?.holidays?.find(holiday => moment(holiday.date).isSame(date, 'day'));
    const isHolidayPresent = !!currentDayHoliday;

    // Check for holiday continuity for borderRadius logic.
    // Note: This needs to check holidays within the currently fetched 'data.holidays' array,
    // which should already be filtered for the month by the backend.
    const isPrevHoliday = data?.holidays?.some(h => moment(h.date).isSame(date.clone().subtract(1, 'day'), 'day'));
    const isNextHoliday = data?.holidays?.some(h => moment(h.date).isSame(date.clone().add(1, 'day'), 'day'));

    const currentDayLeave = events?.[dayIndex]; // events array is 0-indexed for days
    const isLeavePresent = currentDayLeave && ["Casual leave", "Sick leave", "Work from home"].includes(currentDayLeave.type);

    // --- Weekly Off (Saturday or Sunday) Layer ---
    // Z-index: 1 (Lowest)
    if (date.day() === 0 || date.day() === 6) { // 0 for Sunday, 6 for Saturday
      let woffCalculatedBorderRadius = '0'; // Border radius based on WOFF continuity

      // Check continuity for WOFFs to apply corner radius when alone
      const prevDay = moment(date).subtract(1, 'day');
      const nextDay = moment(date).add(1, 'day');
      const isPrevWoff = (prevDay.day() === 0 || prevDay.day() === 6) && prevDay.month() === currentMonth.month();
      const isNextWoff = (nextDay.day() === 0 || nextDay.day() === 6) && nextDay.month() === currentMonth.month();

      const isStartOfWoffBlock = !isPrevWoff;
      const isEndOfWoffBlock = !isNextWoff;
      const isSingleDayWoff = isStartOfWoffBlock && isEndOfWoffBlock;

      if (isSingleDayWoff) {
        woffCalculatedBorderRadius = '50%';
      } else if (isStartOfWoffBlock) {
        woffCalculatedBorderRadius = '50% 0 0 50%';
      } else if (isEndOfWoffBlock) {
        woffCalculatedBorderRadius = '0 50% 50% 0';
      }

      // --- WOFF Overlap Logic ---
      let finalWoffOpacity;
      // The change is here: finalWoffBorderRadius will always be woffCalculatedBorderRadius
      const finalWoffBorderRadius = woffCalculatedBorderRadius;

      // Check if current day is a boundary for an overlapping Holiday/Leave
      const isHolidayBoundaryOnThisDay = isHolidayPresent && (
        !isPrevHoliday || !isNextHoliday // If it's a start or end of a holiday block
      );
      const isLeaveBoundaryOnThisDay = isLeavePresent && (
        !events?.[dayIndex - 1] || events?.[dayIndex - 1].type !== currentDayLeave.type || // Is start
        !events?.[dayIndex + 1] || events?.[dayIndex + 1].type !== currentDayLeave.type // Is end
      );

      if (isHolidayBoundaryOnThisDay || isLeaveBoundaryOnThisDay) {
        // Condition 1: WOFF is a boundary for an overlapping Holiday/Leave
        finalWoffOpacity = 0.9; // Very bright
      } else if (isHolidayPresent || isLeavePresent) {
        // Condition 2: WOFF is covered by the "middle" of an overlapping Holiday/Leave
        finalWoffOpacity = 0.8; // Good bright
      } else {
        // Condition 3: WOFF is alone (no overlap)
        finalWoffOpacity = 0.5; // Default bright
      }

      layers.push({
        type: 'Weekly off',
        color: eventTypeColors["Weekly off"], // Always silver
        zIndex: 1, // Lowest z-index
        opacity: finalWoffOpacity,
        borderRadius: finalWoffBorderRadius, // Apply final border radius
      });
    }

    // --- Holiday Layer ---
    // Z-index: 2 (Middle)
    if (isHolidayPresent) {
      let holidayBorderRadius = '0';
      // Check for continuity of holidays to apply corner radius
      const isPrevHoliday = data.holidays.some(h => moment(h.date).isSame(date.clone().subtract(1, 'day'), 'day'));
      const isNextHoliday = data.holidays.some(h => moment(h.date).isSame(date.clone().add(1, 'day'), 'day'));

      const isStartOfHolidayBlock = !isPrevHoliday;
      const isEndOfHolidayBlock = !isNextHoliday;
      const isSingleDayHoliday = isStartOfHolidayBlock && isEndOfHolidayBlock;

      if (isSingleDayHoliday) {
        holidayBorderRadius = '50%';
      } else if (isStartOfHolidayBlock) {
        holidayBorderRadius = '50% 0 0 50%';
      } else if (isEndOfHolidayBlock) {
        holidayBorderRadius = '0 50% 50% 0';
      }

      // Opacity Logic for Holiday:
      // Dim if overlapped by a Leave, bright if alone or only overlapping WOFF.
      const holidayOpacity = isLeavePresent ? 0.25 : 0.75; // More dim if overlapped by leave, bright if alone/dominating

      layers.push({
        type: 'Holiday',
        color: eventTypeColors["Holiday"],
        name: currentDayHoliday.name, // Use the found holiday's name
        zIndex: 2, // Middle z-index
        opacity: holidayOpacity,
        borderRadius: holidayBorderRadius,
      });
    }

    // --- Leave Events (Casual, Sick, WFH) Layer ---
    // Z-index: 3 (Highest)
    if (isLeavePresent) {
      let leaveBorderRadius = '0';
      // Check for continuity of leaves to apply corner radius
      const prevDayLeave = events?.[dayIndex - 1];
      const nextDayLeave = events?.[dayIndex + 1];

      const isStartOfContinuousLeave = !prevDayLeave || prevDayLeave.type !== currentDayLeave.type;
      const isEndOfContinuousLeave = !nextDayLeave || nextDayLeave.type !== currentDayLeave.type;
      const isSingleDayLeave = isStartOfContinuousLeave && isEndOfContinuousLeave;

      if (isSingleDayLeave) {
        leaveBorderRadius = '50%'; // 50% for single leave
      } else if (isStartOfContinuousLeave) {
        leaveBorderRadius = '50% 0 0 50%';
      } else if (isEndOfContinuousLeave) {
        leaveBorderRadius = '0 50% 50% 0';
      }

      // Opacity Logic for Leaves:
      // Leaves are the highest priority. They are always VERY DIM, whether alone or overlapping.
      const leaveOpacity = 0.4; // Very dim

      layers.push({
        type: currentDayLeave.type,
        color: eventTypeColors[currentDayLeave.type] || 'transparent',
        zIndex: 3, // Highest z-index
        opacity: leaveOpacity,
        borderRadius: leaveBorderRadius,
      });
    }

    // Sort layers by z-index to ensure correct visual stacking (lowest z-index drawn first)
    return layers.sort((a, b) => a.zIndex - b.zIndex);
  };

  const handleMonthChange = (months) => {
    setCurrentMonth(moment(currentMonth).add(months, 'months'));
  };

  if (loading) return (
    <div className="calendar-loading">
      <div className="spinner"></div>
      Loading calendar data...
    </div>
  );

  if (error) return (
    <div className="calendar-error">
      <p>{error}</p>
      <button onClick={() => window.location.reload()}>Retry</button>
    </div>
  );

  const daysInMonth = generateDaysInMonth();

  // --- Conditional Rendering for Empty Team Calendar Data ---
  if (!data || !data.teamCalendarData || data.teamCalendarData.length === 0) {
    return (
      <div className="keka-calendar-container">
        <div className="calendar-controls">
          <button onClick={() => handleMonthChange(-1)}>&lt; Previous</button>
          <h2>{currentMonth.format('MMMM YYYY')}</h2>
          <button onClick={() => handleMonthChange(1)}>Next &gt;</button>
        </div>
        <div className="calendar-empty">
          <p>No team members have recorded events leaves for {currentMonth.format('MMMM YYYY')}.</p>
        </div>
        {/* Still display the legend even if no team members are shown */}
        <div className="calendar-legend">
          {["Weekly off", "Holiday", "Casual leave", "Sick leave", "Work from home"].map(type => (
            eventTypeColors[type] && (
              <div key={type} className="legend-item">
                <span
                  className="legend-color"
                  style={{
                    backgroundColor: eventTypeColors[type],
                    opacity: type === "Weekly off" ? 0.5 : type === "Holiday" ? 0.75 : 0.4,
                    borderRadius: '50%',
                  }}
                ></span>
                <span>{type}</span>
              </div>
            )
          ))}
        </div>
      </div>
    );
  }

  // --- Normal rendering when data.teamCalendarData is not empty ---
  return (
    <div className="keka-calendar-container">
      <div className="calendar-controls">
        <button onClick={() => handleMonthChange(-1)}>&lt; Previous</button>
        <h2>{currentMonth.format('MMMM YYYY')}</h2>
        <button onClick={() => handleMonthChange(1)}>Next &gt;</button>
      </div>

      <div className="team-calendar">
        <div className="calendar-header">
          <div className="name-cell header-cell">Employee</div>
          {daysInMonth.map((day, index) => (
            <div
              key={index}
              className={`day-cell header-cell ${day.day() === 0 || day.day() === 6 ? 'weekend' : ''}`}
            >
              {day.format('D')}
            </div>
          ))}
        </div>

        <div className="calendar-body">
          {data.teamCalendarData.map(member => (
            <div key={member.id} className="calendar-row">
              <div className="name-cell" title={member.name}>
                {member.name}
              </div>
              {daysInMonth.map((day, index) => {
                const layers = getEventLayers(member.events, index);
                const dateNumber = day.date();

                return (
                  <div
                    key={index}
                    className="event-cell"
                    title={layers.map(l => l.type).join(' + ')}
                  >
                    <div className="date-number">{dateNumber}</div>
                    <div className="event-layers">
                      {layers.map((layer, i) => (
                        <div
                          key={i}
                          className="event-layer"
                          style={{
                            backgroundColor: layer.color,
                            zIndex: layer.zIndex,
                            opacity: layer.opacity,
                            borderRadius: layer.borderRadius,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="calendar-legend">
        {["Weekly off", "Holiday", "Casual leave", "Sick leave", "Work from home"].map(type => (
          eventTypeColors[type] && (
            <div key={type} className="legend-item">
              <span
                className="legend-color"
                style={{
                  backgroundColor: eventTypeColors[type],
                  opacity: type === "Weekly off" ? 0.5 : type === "Holiday" ? 0.75 : 0.4,
                  borderRadius: '50%',
                }}
              ></span>
              <span>{type}</span>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default KekaTeamCalendar;