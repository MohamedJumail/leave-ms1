import React, { useState } from "react";
import '../styles/Leave.css'; // Assuming your styles are global or you'll manage them
import { FULL_DAY, FIRST_HALF, SECOND_HALF } from '../constants/leaveTypes'; // Create this file or define them here

const HALF_DAY_MAP = {
    [FULL_DAY]: 'Full Day',
    [FIRST_HALF]: 'First Half (Morning)',
    [SECOND_HALF]: 'Second Half (Afternoon)',
};

// You might want to create a constants file for these to avoid duplication
// src/constants/leaveTypes.js
// export const FULL_DAY = 1;
// export const FIRST_HALF = 2;
// export const SECOND_HALF = 3;


const LeaveCard = ({ leave, onCancel, onViewStatus }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leaveEndDate = new Date(leave.end_date);
    leaveEndDate.setHours(0, 0, 0, 0);

    const showCancelButton = (leave.status === "Pending" || leave.status === "Approved") &&
                             (leaveEndDate >= today);

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case "Pending":
                return "status-badge pending";
            case "Approved":
                return "status-badge approved";
            case "Rejected":
            case "Cancelled":
                return "status-badge rejected";
            default:
                return "status-badge";
        }
    };

    return (
        <div key={leave.id} className="leave-card">
            <div className="leave-card-header">
                <h4 className="leave-type">{leave.leave_type}</h4>
                <span className={getStatusBadgeClass(leave.status)}>{leave.status}</span>
            </div>
            <div className="leave-card-body">
                <p><strong>From:</strong> {new Date(leave.start_date).toLocaleDateString()}</p>
                {leave.start_half_day_type && leave.start_half_day_type !== FULL_DAY && (
                    <p><strong>Start Half-Day:</strong> {HALF_DAY_MAP[leave.start_half_day_type]}</p>
                )}
                <p><strong>To:</strong> {new Date(leave.end_date).toLocaleDateString()}</p>
                {leave.end_half_day_type && leave.end_half_day_type !== FULL_DAY && (
                    <p><strong>End Half-Day:</strong> {HALF_DAY_MAP[leave.end_half_day_type]}</p>
                )}
                {typeof leave.calculated_days === 'number' && (
                    <p><strong>Requested Days:</strong> {leave.calculated_days} days</p>
                )}
                <p><strong>Reason:</strong> {leave.reason}</p>
            </div>
            <div className="leave-card-actions">
                {showCancelButton && (
                    <button onClick={() => onCancel(leave.id)} className="cancel-btn" type="button">
                        Cancel
                    </button>
                )}
                <button onClick={() => onViewStatus(leave.id)} className="view-status-btn" type="button">
                    View Status
                </button>
            </div>
        </div>
    );
};

const LeaveHistory = ({ leaves, fetchLeaveStatus, cancelLeave }) => {
    const [historyFilter, setHistoryFilter] = useState("All");

    const renderFilteredHistory = () => {
        let filteredLeaves = leaves;
        if (historyFilter !== "All") {
            filteredLeaves = leaves.filter((l) => l.status === historyFilter);
        }
        if (filteredLeaves.length === 0) {
            return <p className="status-text">No {historyFilter.toLowerCase()} leave requests found.</p>;
        }
        return filteredLeaves.map((leave) => (
            <LeaveCard
                key={leave.id}
                leave={leave}
                onViewStatus={fetchLeaveStatus}
                onCancel={cancelLeave}
            />
        ));
    };

    return (
        <>
            <div
                className="history-filter-buttons"
                role="group"
                aria-label="Filter Leave History"
            >
                {["All", "Pending", "Approved", "Rejected", "Cancelled"].map(
                    (status) => (
                        <button
                            key={status}
                            onClick={() => setHistoryFilter(status)}
                            className={`history-filter-btn ${historyFilter === status ? "active" : ""}`}
                            type="button"
                            aria-pressed={historyFilter === status}
                        >
                            {status}
                        </button>
                    )
                )}
            </div>
            {renderFilteredHistory()}
        </>
    );
};

export default LeaveHistory;