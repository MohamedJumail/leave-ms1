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
    const [currentRequestId, setCurrentRequestId] = useState(null); // To hold the ID of the request being acted upon
    const [currentDecision, setCurrentDecision] = useState(null); // To hold the decision (Approve/Reject)

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

    const handleApproval = async (requestId, decision, reason = null) => {
        setActionLoadingId(requestId);
        try {
            await api.put(
                `/api/leave/approve-reject/${requestId}`,
                { decision, reason }, // Send decision and reason in the payload
                { headers: { Authorization: `Bearer ${token}` } }
            );
            fetchLeaveRequests(); // Refresh leave requests after action
            setIsRejectModalOpen(false); // Close the modal after rejection
            setCurrentRequestId(null);
            setCurrentDecision(null);
        } catch (error) {
            console.error(`Error ${decision.toLowerCase()}ing leave request:`, error);
            // Optionally display an error message to the user
        } finally {
            setActionLoadingId(null);
        }
    };

    const handleApproveClick = (requestId) => {
        handleApproval(requestId, 'Approved', null); // Send null reason for approval
    };

    const handleRejectClick = (requestId) => {
        setCurrentRequestId(requestId);
        setCurrentDecision('Rejected');
        setIsRejectModalOpen(true);
    };

    const closeRejectModal = () => {
        setIsRejectModalOpen(false);
        setCurrentRequestId(null);
        setCurrentDecision(null);
    };

    const handleConfirmReject = (reasonFromModal) => {
        if (currentRequestId) {
            handleApproval(currentRequestId, currentDecision, reasonFromModal);
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
                        onClick={() => handleApproveClick(request.id)}
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
            />
        </div>
    );
};

export default LeaveApproval;