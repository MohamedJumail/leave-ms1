// src/pages/LeaveApproval.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../styles/LeaveApproval.css';
import RejectReasonModal from '../components/RejectReasonModal'; // Import the RejectReasonModal

const leaveTypesMap = {
  1: 'Casual Leave',
  2: 'Sick Leave',
  3: 'Earned Leave',
};

const LeaveApproval = () => {
  const { token, user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectRequestId, setRejectRequestId] = useState(null); // State to hold the ID of the request being rejected

  useEffect(() => {
    fetchLeaveRequests();
  }, [token]);

  const fetchLeaveRequests = async () => {
    setLoading(true);
    try {
      let apiUrl = '/api/leave/all-requests'; // Default for HR and Manager
      if (user?.role === 'Admin') {
        apiUrl = '/api/leave/admin-requests';
      }

      const response = await api.get(apiUrl, {
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

  // This function handles both approval and rejection
  // 'reason' is only provided when 'decision' is 'Rejected'
  const handleApproval = async (requestId, decision, reason = '') => {
    setActionLoadingId(requestId);
    try {
      await api.put(
        `/api/leave/approve-reject/${requestId}`,
        { decision, reason }, // Send decision and reason in the payload
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchLeaveRequests(); // Refresh leave requests after action
      setIsRejectModalOpen(false); // Close the modal after rejection
      setRejectRequestId(null); // Clear the stored request ID
    } catch (error) {
      console.error(`Error approving/rejecting leave request:`, error);
      // Optionally display an error message to the user
    } finally {
      setActionLoadingId(null);
    }
  };

  // Opens the rejection modal and stores the requestId
  const handleRejectClick = (requestId) => {
    setRejectRequestId(requestId);
    setIsRejectModalOpen(true);
  };

  // Closes the rejection modal and clears the stored requestId
  const closeRejectModal = () => {
    setIsRejectModalOpen(false);
    setRejectRequestId(null);
  };

  // This function is called by the RejectReasonModal when the user confirms rejection
  const handleConfirmReject = (reasonFromModal) => {
    if (rejectRequestId) {
      // Call handleApproval with the stored requestId, 'Rejected' decision, and the reason from the modal
      handleApproval(rejectRequestId, 'Rejected', reasonFromModal);
    }
  };

  const filteredLeaveRequests = leaveRequests.filter((request) =>
    request.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    (request.leave_type || leaveTypesMap[request.leave_type_id])?.toLowerCase().includes(search.toLowerCase())
  );

  const renderApprovalActions = (request) => {
    if (user?.role === 'Admin' || user?.role === 'HR' || user?.role === 'Manager') {
      return (
        <td>
          <button
            className="btn-approve"
            onClick={() => handleApproval(request.id, 'Approved')}
            disabled={actionLoadingId === request.id}
          >
            {actionLoadingId === request.id ? 'Approving...' : 'Approve'}
          </button>
          <button
            className="btn-reject"
            onClick={() => handleRejectClick(request.id)} // Open modal on reject click
            disabled={actionLoadingId === request.id}
          >
            {actionLoadingId === request.id ? 'Rejecting...' : 'Reject'}
          </button>
        </td>
      );
    }
    return <td>{request.manager_approval}</td>; // For regular employees
  };

  const getApprovalHeader = () => {
    if (user?.role === 'Admin' || user?.role === 'HR' || user?.role === 'Manager') {
      return <th>Actions</th>;
    }
    return <th>Manager Approval</th>;
  };

  return (
    <div className="pending-leave-requests-container">
      <div className="header-row">
        <h2>Leave Approval</h2>
        <input
          type="text"
          placeholder="Search by employee name or leave type"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <p className="loading-text">Loading leave requests...</p>
      ) : filteredLeaveRequests.length === 0 ? (
        <p className="no-requests">No leave requests found.</p>
      ) : (
        <table className="requests-table">
          <thead>
            <tr>
              <th>Employee Name</th>
              <th>Leave Type</th>
              <th>Start Date</th>
              <th>End Date</th>
              <th>Reason</th>
              {getApprovalHeader()}
            </tr>
          </thead>
          <tbody>
            {filteredLeaveRequests.map((request) => (
              <tr key={request.id}>
                <td>{request.employee_name}</td>
                <td>{request.leave_type || leaveTypesMap[request.leave_type_id]}</td>
                <td>{new Date(request.start_date).toLocaleDateString()}</td>
                <td>{new Date(request.end_date).toLocaleDateString()}</td>
                <td>{request.reason}</td>
                {renderApprovalActions(request)}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Render the Reject Reason Modal */}
      <RejectReasonModal
        isOpen={isRejectModalOpen}
        onRequestClose={closeRejectModal}
        onConfirmReject={handleConfirmReject} // Pass the new handler
        // requestId is no longer passed to the modal, as the modal only needs to return the reason
      />
    </div>
  );
};

export default LeaveApproval;