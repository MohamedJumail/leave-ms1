import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './LeaveApproval.css';

const LeaveApproval = () => {
  const { token } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  useEffect(() => {
    fetchLeaveRequests();
  }, [token]);

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/leave/admin-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Array.isArray(response.data)) {
        setLeaveRequests(response.data);
      } else {
        console.error("Unexpected leave request data:", response.data);
        setLeaveRequests([]);
      }
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (requestId, decision) => {
    try {
      await api.put(`/api/leave/approve-reject/${requestId}`, 
        { decision },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchLeaveRequests(); // Refresh leave requests after action
    } catch (error) {
      console.error(`Error approving/rejecting leave request:`, error);
    }
  };

  const filteredLeaveRequests = leaveRequests.filter(
    (request) =>
      request.employee_name.toLowerCase().includes(search.toLowerCase()) ||
      request.leave_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="leave-approval">
      <div className="card">
        <div className="header-row">
          <h2>Leave Approval</h2>
          <input
            type="text"
            placeholder="Search by employee name or leave type"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-box"
          />
        </div>

        {loading ? (
          <p className="status-text">Loading leave requests...</p>
        ) : filteredLeaveRequests.length === 0 ? (
          <p className="status-text">No leave requests found.</p>
        ) : (
          <table className="leave-requests-table">
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaveRequests.map((request) => (
                <tr key={request.id}>
                  <td>{request.employee_name}</td>
                  <td>{request.leave_type}</td>
                  <td>{new Date(request.start_date).toLocaleDateString()}</td>
                  <td>{new Date(request.end_date).toLocaleDateString()}</td>
                  <td>{request.reason}</td>
                  <td>
                    <button
                      className="approve-btn"
                      onClick={() => handleApproval(request.id, 'Approved')}
                    >
                      Approve
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => handleApproval(request.id, 'Rejected')}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LeaveApproval;
