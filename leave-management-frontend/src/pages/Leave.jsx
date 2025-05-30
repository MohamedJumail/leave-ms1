import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import '../styles/Leave.css';
import LeaveStatusModal from '../components/LeaveStatusModal'; // Import the new modal

const Leave = () => {
    const { token } = useAuth();

    const [leaves, setLeaves] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [leaveBalances, setLeaveBalances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [historyVisible, setHistoryVisible] = useState(false);
    const [error, setError] = useState("");
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [selectedLeaveId, setSelectedLeaveId] = useState(null);
    const [leaveStatusDetails, setLeaveStatusDetails] = useState(null);
    const [workingDays, setWorkingDays] = useState(0);

    const [formData, setFormData] = useState({
        leave_type_id: "",
        start_date: "",
        end_date: "",
        reason: "",
    });

    const [historyFilter, setHistoryFilter] = useState("All");

    const fetchLeaveTypes = async () => {
        try {
            const response = await api.get("/api/leave-types", {
                headers: { Authorization: `Bearer ${token}` },
            });
            console.log("Leave Types Fetched:", response.data);
            setLeaveTypes(response.data);
        } catch (err) {
            console.error("Error fetching leave types:", err);
            setError("Failed to load leave types");
        }
    };

    const fetchLeaves = async () => {
        try {
            const response = await api.get("/api/leave/my-requests", {
                headers: { Authorization: `Bearer ${token}` },
            });
            console.log("Leaves Fetched:", response.data);
            setLeaves(response.data);
        } catch (err) {
            console.error("Error fetching leaves:", err);
            setError("Failed to load leave data");
        }
    };

    const fetchLeaveBalances = async () => {
        try {
            const response = await api.get("/api/leave-balances", {
                headers: { Authorization: `Bearer ${token}` },
            });
            console.log("Leave Balances Fetched:", response.data);
            setLeaveBalances(response.data);
        } catch (err) {
            console.error("Error fetching leave balances:", err);
            setError("Failed to load leave balances");
        }
    };

    const fetchLeaveStatus = async (leaveId) => {
        // Set modal to open and show loading state immediately
        setSelectedLeaveId(leaveId);
        setLeaveStatusDetails(null); // Clear previous details
        setIsStatusModalOpen(true);

        try {
            const response = await api.get(`/api/leave/status/${leaveId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            console.log(`Leave Status for ID ${leaveId}:`, response.data);
            setLeaveStatusDetails(response.data);
        } catch (error) {
            console.error("Error fetching leave status:", error);
            setError("Failed to load leave status");
            setLeaveStatusDetails([]); // Set to empty array to indicate no data/error
        }
    };

    const useEffectCleanup = () => {
        setLeaves([]);
        setLeaveTypes([]);
        setLeaveBalances([]);
        setLoading(true);
        setError("");
        setHistoryVisible(false);
        setFormData({ leave_type_id: "", start_date: "", end_date: "", reason: "" });
        setHistoryFilter("All");
        setIsStatusModalOpen(false);
        setSelectedLeaveId(null);
        setLeaveStatusDetails(null);
        setWorkingDays(0);
    };

    useEffect(() => {
        if (token) {
            Promise.all([
                fetchLeaveTypes(),
                fetchLeaves(),
                fetchLeaveBalances(),
            ]).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }

        return useEffectCleanup; // Cleanup on unmount or token change
    }, [token]);

    const calculateWorkingDays = (startDate, endDate) => {
        if (!startDate || !endDate) {
            return 0;
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        let days = 0;
        let currentDate = new Date(start);

        while (currentDate <= end) {
            const dayOfWeek = currentDate.getDay();
            // Skip weekends (Saturday: 6, Sunday: 0)
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                days++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return days;
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));

        if (name === 'start_date' || name === 'end_date') {
            setWorkingDays(calculateWorkingDays(
                name === 'start_date' ? value : formData.start_date,
                name === 'end_date' ? value : formData.end_date
            ));
        }
    };

    const submitLeaveRequest = async (e) => {
        e.preventDefault();

        const formDataToSend = {
            ...formData,
            leave_type_id: Number(formData.leave_type_id),
            number_of_days: workingDays, // Include calculated working days
        };

        console.log("Submitting Leave Request with data:", formDataToSend);

        try {
            const response = await api.post("/api/leave/apply", formDataToSend, {
                headers: { Authorization: `Bearer ${token}` },
            });
            console.log("Leave Request Successful:", response.data);
            alert("Leave request submitted successfully"); // Consider a custom modal instead of alert
            setFormData({
                leave_type_id: "",
                start_date: "",
                end_date: "",
                reason: "",
            });
            setWorkingDays(0);
            fetchLeaves();
            fetchLeaveBalances(); // Refresh balances after applying
        } catch (err) {
            console.error("Error submitting leave request:", err);
            if (err.response) {
                setError(err.response.data.msg || "Could not submit leave request");
                console.log("Server Response:", err.response.data);
            } else {
                setError("Could not submit leave request");
            }
        }
    };

    const cancelLeave = async (leaveId) => {
        try {
            await api.put(
                `/api/leave/cancel/${leaveId}`,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setLeaves((prev) =>
                prev.map((l) => (l.id === leaveId ? { ...l, status: "Cancelled" } : l))
            );
        } catch (err) {
            console.error("Error cancelling leave:", err);
            setError("Could not cancel leave");
        }
    };

    // Helper: status to badge class
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

    // Leave card component (reusable for both sections)
    const LeaveCard = ({ leave, onCancel, onViewStatus, showCancelButton }) => (
        <div key={leave.id} className="leave-card">
            <div className="leave-card-header">
                <h4 className="leave-type">{leave.leave_type}</h4>
                <span className={getStatusBadgeClass(leave.status)}>{leave.status}</span>
            </div>
            <div className="leave-card-body">
                <p><strong>From:</strong> {leave.start_date.split("T")[0]}</p>
                <p><strong>To:</strong> {leave.end_date.split("T")[0]}</p>
                <p><strong>Reason:</strong> {leave.reason}</p>
                {leave.number_of_days && <p><strong>Days:</strong> {leave.number_of_days}</p>}
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

    // Render leave requests by status for the "Pending" section
    const renderLeavesByStatus = (status) =>
        leaves
            .filter((leave) => leave.status === status)
            .map((leave) => (
                <LeaveCard
                    key={leave.id}
                    leave={leave}
                    onCancel={cancelLeave}
                    onViewStatus={fetchLeaveStatus}
                    showCancelButton={status === "Pending"} // Only show cancel for pending
                />
            ));

    // Render leave history with filter and colored badges
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
                showCancelButton={false} // Never show cancel button in history
            />
        ));
    };

    const closeStatusModal = () => {
        setIsStatusModalOpen(false);
        setSelectedLeaveId(null);
        setLeaveStatusDetails(null);
    };

    if (loading) return <p>Loading leave data...</p>;
    if (error) return <p className="error-text">{error}</p>;

    return (
        <div className="leave-container">
            {/* Leave Balances Cards */}
            <h2 className="balances-heading">Leave Balances</h2>
            <div className="leave-balances-container" aria-label="Leave Balances">
                {leaveBalances.map(({ id, leave_type, balance }) => (
                    <div key={id} className="leave-balance-card" title={`${leave_type} Balance`}>
                        <h4>{leave_type}</h4>
                        <p>{balance} days</p>
                    </div>
                ))}
            </div>

            <div className="header-row">
                <h2>Apply for Leave</h2>
                <button
                    onClick={() => setHistoryVisible(!historyVisible)}
                    className="yellow-btn"
                    type="button"
                    aria-label="Toggle Leave History"
                >
                    {historyVisible ? "Hide Leave History" : "View Leave History"}
                </button>
            </div>

            {!historyVisible ? (
                <>
                    <form onSubmit={submitLeaveRequest} className="leave-form">
                        <div className="form-group">
                            <label htmlFor="leave_type_id">Leave Type:</label>
                            <select
                                id="leave_type_id"
                                name="leave_type_id"
                                value={formData.leave_type_id}
                                onChange={handleFormChange}
                                required
                            >
                                <option value="">Select</option>
                                {leaveTypes.map((type) => {
                                    // Find the corresponding balance for this leave type
                                    const balanceInfo = leaveBalances.find(
                                        (balance) => balance.leave_type === type.name
                                    );
                                    const balance = balanceInfo ? balanceInfo.balance : 'N/A';
                                    return (
                                        <option key={type.id} value={type.id}>
                                            {type.name} ({balance} days)
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="start_date">Start Date:</label>
                            <input
                                id="start_date"
                                type="date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleFormChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="end_date">End Date:</label>
                            <input
                                id="end_date"
                                type="date"
                                name="end_date"
                                value={formData.end_date}
                                onChange={handleFormChange}
                                required
                            />
                        </div>
                        {formData.start_date && formData.end_date && (
                            <div className="form-group">
                                <label>Working Days:</label>
                                <p>{workingDays}</p>
                            </div>
                        )}
                        <div className="form-group">
                            <label htmlFor="reason">Reason:</label>
                            <textarea
                                id="reason"
                                name="reason"
                                value={formData.reason}
                                onChange={handleFormChange}
                                required
                                rows="3"
                                placeholder="Provide a reason for your leave"
                            />
                        </div>
                        <button type="submit" className="yellow-btn submit-btn">
                            Submit Leave
                        </button>
                    </form>

                    <h3 style={{ color: "#1DA1F2", marginBottom: "1rem" }}>
                        Pending Leave Requests
                    </h3>
                    {renderLeavesByStatus("Pending")}
                </>
            ) : (
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
            )}

            {/* Leave Status Modal */}
            <LeaveStatusModal
                isOpen={isStatusModalOpen}
                onRequestClose={closeStatusModal}
                leaveId={selectedLeaveId}
                leaveStatusDetails={leaveStatusDetails}
            />
        </div>
    );
};

export default Leave;