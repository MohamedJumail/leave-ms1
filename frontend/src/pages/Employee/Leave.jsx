import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import "./Leave.css";

const Leave = () => {
  const { token } = useAuth();

  const [leaves, setLeaves] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [error, setError] = useState("");

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
      setLeaveBalances(response.data);
    } catch (err) {
      console.error("Error fetching leave balances:", err);
      setError("Failed to load leave balances");
    }
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
  }, [token]);

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

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const submitLeaveRequest = async (e) => {
    e.preventDefault();

    const formDataToSend = {
      ...formData,
      leave_type_id: Number(formData.leave_type_id),
    };

    try {
      await api.post("/api/leave/apply", formDataToSend, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Leave request submitted successfully");
      setFormData({
        leave_type_id: "",
        start_date: "",
        end_date: "",
        reason: "",
      });
      fetchLeaves();
      fetchLeaveBalances(); // Refresh balances after applying
    } catch (err) {
      if (err.response) {
        setError(err.response.data.msg || "Could not submit leave request");
      } else {
        setError("Could not submit leave request");
      }
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

  // Leave card for Pending section
  const renderLeavesByStatus = (status) =>
    leaves
      .filter((leave) => leave.status === status)
      .map((leave) => (
        <div key={leave.id} className="leave-card">
          <div className="leave-card-header">
            <h4 className="leave-type">{leave.leave_type}</h4>
            <span className={getStatusBadgeClass(leave.status)}>
              {leave.status}
            </span>
          </div>
          <div className="leave-card-body">
            <p>
              <strong>From:</strong> {leave.start_date.split("T")[0]}
            </p>
            <p>
              <strong>To:</strong> {leave.end_date.split("T")[0]}
            </p>
            <p>
              <strong>Reason:</strong> {leave.reason}
            </p>
          </div>
          {status === "Pending" && (
            <button
              onClick={() => cancelLeave(leave.id)}
              className="cancel-btn"
              type="button"
            >
              Cancel
            </button>
          )}
        </div>
      ));

  // Leave history with filter and colored badges
  const renderFilteredHistory = () => {
    let filteredLeaves = leaves;
    if (historyFilter !== "All") {
      filteredLeaves = leaves.filter((l) => l.status === historyFilter);
    }
    if (filteredLeaves.length === 0) {
      return (
        <p className="status-text">
          No {historyFilter.toLowerCase()} leave requests found.
        </p>
      );
    }
    return filteredLeaves.map((leave) => (
      <div key={leave.id} className="leave-card history-card">
        <div className="leave-card-header">
          <h4 className="leave-type">{leave.leave_type}</h4>
          <span className={getStatusBadgeClass(leave.status)}>
            {leave.status}
          </span>
        </div>
        <div className="leave-card-body">
          <p>
            <strong>From:</strong> {leave.start_date.split("T")[0]}
          </p>
          <p>
            <strong>To:</strong> {leave.end_date.split("T")[0]}
          </p>
          <p>
            <strong>Reason:</strong> {leave.reason}
          </p>
        </div>
      </div>
    ));
  };

  if (loading) return <p>Loading leave data...</p>;
  if (error) return <p className="error-text">{error}</p>;

  return (
    <div className="leave-container">
      {/* Leave Balances Cards */}
      <h2 className="balances-heading">Leave Balances</h2>
      <div className="leave-balances-container" aria-label="Leave Balances">
        {leaveBalances.map(({ id, leave_type, balance }) => (
          <div
            key={id}
            className="leave-balance-card"
            title={`${leave_type} Balance`}
          >
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
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
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
                  className={`history-filter-btn ${
                    historyFilter === status ? "active" : ""
                  }`}
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
    </div>
  );
};

export default Leave;
