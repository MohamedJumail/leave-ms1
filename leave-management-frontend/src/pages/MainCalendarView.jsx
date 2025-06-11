// src/components/MainCalendarView.jsx
import React, { useState } from 'react';
import Calendar from './Calendar'; // Your existing individual calendar component (e.g., PersonalCalendar)
import KekaTeamCalendar from './KekaTeamCalendar'; // The refactored team calendar component
import '../styles/MainCalendarView.css'; // Your MainCalendarView specific styles

function MainCalendarView() {
    const [activeCalendar, setActiveCalendar] = useState('personal'); // 'personal' or 'team'

    const handleToggleCalendar = (calendarType) => {
        setActiveCalendar(calendarType);
    };

    return (
        <div className="main-calendar-container">
            <header className="calendar-header-section">
                <div className="calendar-type-toggle">
                    <button
                        className={`toggle-button ${activeCalendar === 'personal' ? 'active' : ''}`}
                        onClick={() => handleToggleCalendar('personal')}
                    >
                        My Calendar
                    </button>
                    <button
                        className={`toggle-button ${activeCalendar === 'team' ? 'active' : ''}`}
                        onClick={() => handleToggleCalendar('team')}
                    >
                        Team Calendar
                    </button>
                </div>

                {/* Removed month navigation controls from here as they are now inside KekaTeamCalendar */}
                {/* You might want a generic "Calendar View" title here, or nothing if KekaTeamCalendar has its own. */}
                {/* For example: <span className="current-display-month">Calendar View</span> */}
            </header>

            <main className="calendar-main-content">
                {activeCalendar === 'personal' ? (
                    <Calendar /> // Renders your individual calendar without changes
                ) : (
                    <KekaTeamCalendar /> // Renders the self-contained team calendar
                )}
            </main>
        </div>
    );
}

export default MainCalendarView;