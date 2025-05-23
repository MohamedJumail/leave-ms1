import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './PendingLeaveRequests.css';

const leaveTypesMap = {
  1: 'Casual Leave',
  2: 'Sick Leave',
  3: 'Earned Leave',
};

const PendingLeaveRequestsHR = () => {
  const { token } = useAuth();
  const [requests, setRequests] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/leave/all-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(res.data || []);
    } catch (err) {
      console.error('Error fetching leave requests:', err);
    }
    setLoading(false);
  };

  const handleDecision = async (leaveId, decision) => {
    setActionLoadingId(leaveId);
    try {
      await api.put(
        `/api/leave/approve-reject/${leaveId}`,
        { decision },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchRequests();
    } catch (err) {
      console.error('Error updating leave request:', err);
    }
    setActionLoadingId(null);
  };

  const filteredRequests = requests.filter((req) =>
    req.employee_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pending-leave-requests-container">
      <h2>Pending Leave Requests</h2>
      <input
        type="text"
        className="search-input"
        placeholder="Search by employee name..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      {loading ? (
        <p className="loading-text">Loading requests...</p>
      ) : (
        <table className="requests-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Leave Type</th>
              <th>From</th>
              <th>To</th>
              <th>Days</th>
              <th>Your Approval</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length > 0 ? (
              filteredRequests.map((req) => {
                const fromDate = new Date(req.start_date).toLocaleDateString();
                const toDate = new Date(req.end_date).toLocaleDateString();
                const days =
                  (new Date(req.end_date) - new Date(req.start_date)) / (1000 * 60 * 60 * 24) + 1;

                return (
                  <tr key={req.id}>
                    <td>{req.employee_name}</td>
                    <td>{req.leave_type || leaveTypesMap[req.leave_type_id]}</td>
                    <td>{fromDate}</td>
                    <td>{toDate}</td>
                    <td>{days}</td>
                    <td>{req.manager_approval}</td>
                    <td>
                      <button
                        className="btn-approve"
                        disabled={actionLoadingId === req.id}
                        onClick={() => handleDecision(req.id, 'Approved')}
                      >
                        Approve
                      </button>
                      <button
                        className="btn-reject"
                        disabled={actionLoadingId === req.id}
                        onClick={() => handleDecision(req.id, 'Rejected')}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="no-requests">No pending leave requests found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default PendingLeaveRequestsHR;
