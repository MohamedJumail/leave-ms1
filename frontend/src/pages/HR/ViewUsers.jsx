import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import "./ViewUsers.css";

const ViewUsersHR = () => {
  const { token, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [viewAll, setViewAll] = useState(false);

  const leaveTypes = {
    1: "Casual Leave",
    2: "Sick Leave",
    3: "Earned Leave",
  };

  useEffect(() => {
    if (viewAll) fetchAllUsers();
    else fetchUsersUnderMe();
  }, [viewAll]);

  const fetchUsersUnderMe = async () => {
    try {
      const res = await api.get("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allUsers = res.data;
      let filtered = [];

      if (user.role === "HR") {
        filtered = allUsers.filter((u) => u.hr_id === user.id);
      } else if (user.role === "Manager") {
        filtered = allUsers.filter((u) => u.manager_id === user.id);
      }

      setUsers(filtered);
    } catch (error) {
      console.error("Error fetching users under manager/HR:", error);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await api.get("/api/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(res.data);
    } catch (error) {
      console.error("Error fetching all users:", error);
    }
  };

  const fetchLeaveDetails = async (userId) => {
    try {
      const [balanceRes, pendingRes] = await Promise.all([
        api.get(`/api/leave-balances/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        viewAll
          ? api.get(`/api/leave/admin-view-pending/${userId}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
          : api.get(`/api/leave/my-pending-requests/${userId}`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
      ]);

      setLeaveBalances(balanceRes.data || []);
      setPendingLeaves(pendingRes.data || []);
      setSelectedUserId(userId);
    } catch (error) {
      console.error("Error fetching leave details:", error);
      setLeaveBalances([]);
      setPendingLeaves([]);
    }
  };

  const handleDecision = async (leaveId, decision) => {
    try {
      await api.put(
        `/api/leave/approve-reject/${leaveId}`,
        { decision },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (selectedUserId) {
        fetchLeaveDetails(selectedUserId);
      }
    } catch (error) {
      console.error("Error approving/rejecting leave:", error);
    }
  };

  const filteredUsers = users.filter((u) =>
    u?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="view-users-container">
      <div className="user-list-section">
        <h2>Team Members</h2>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="user-search-input"
          />
          <label>
            <input
              type="checkbox"
              checked={viewAll}
              onChange={(e) => setViewAll(e.target.checked)}
              style={{ marginRight: "8px" }}
            />
            View all users
          </label>
        </div>
        <table className="user-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Leave Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.department}</td>
                  <td>
                    <button
                      className="btn-view-details"
                      onClick={() => fetchLeaveDetails(u.id)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="no-users">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedUserId && (
        <div className="modal-overlay" onClick={() => setSelectedUserId(null)}>
          <div
            className="leave-details-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="btn-close-details"
              onClick={() => setSelectedUserId(null)}
            >
              &times;
            </button>

            <h2 className="panel-title">Leave Details</h2>

            {/* Leave Balances */}
            <section className="leave-balance-section">
              <h3>Leave Balances</h3>
              <table className="leave-balance-table">
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {leaveBalances.length > 0 ? (
                    leaveBalances.map((b) => (
                      <tr key={b.id}>
                        <td>{b.leave_type}</td>
                        <td>{b.balance}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="2">No balances found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            {/* Pending Leave Requests */}
            {/* Pending Leave Requests */}
            <section className="pending-leaves-section">
              <h3>Pending Leave Requests</h3>
              <table className="pending-leaves-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Days</th>
                    <th>Status</th>
                    {viewAll ? (
                      <th>Next Decision</th>
                    ) : (
                      // Removed Manager Approval, Director Approval, HR Approval columns
                      <th>Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pendingLeaves.length > 0 ? (
                    pendingLeaves.map((leave) => {
                      const from = new Date(leave.start_date);
                      const to = new Date(leave.end_date);
                      const days =
                        Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

                      return (
                        <tr key={leave.id}>
                          <td>
                            {leaveTypes[leave.leave_type_id] ||
                              leave.leave_type_id}
                          </td>
                          <td>{from.toLocaleDateString()}</td>
                          <td>{to.toLocaleDateString()}</td>
                          <td>{days}</td>
                          <td>{leave.status}</td>

                          {viewAll ? (
                            <td>{leave.next_decision}</td>
                          ) : (
                            <td>
                              <div className="button-group">
                                <button
                                  className="btn-approve"
                                  onClick={() =>
                                    handleDecision(leave.id, "Approved")
                                  }
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn-reject"
                                  onClick={() =>
                                    handleDecision(leave.id, "Rejected")
                                  }
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={viewAll ? "6" : "6"}
                        style={{ textAlign: "center" }}
                      >
                        No pending leave requests.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewUsersHR;
