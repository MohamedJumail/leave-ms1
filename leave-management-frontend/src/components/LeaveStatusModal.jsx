// src/components/LeaveStatusModal.jsx
import React from 'react';
import Modal from 'react-modal';
import './LeaveStatusModal.css'; // Link to the new CSS file
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faCheckCircle, faTimesCircle, faExclamationCircle } from '@fortawesome/free-solid-svg-icons';

const customStyles = {
    content: {
        top: '50%',
        left: '50%',
        right: 'auto',
        bottom: 'auto',
        marginRight: '-50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#1e1e1e',
        border: '1px solid #1DA1F2',
        borderRadius: '10px',
        padding: '30px 25px',
        maxWidth: '600px',
        width: '90%',
        boxShadow: '0 0 20px rgba(29, 161, 242, 0.3)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
    },
    overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 999,
        backdropFilter: 'blur(8px)',
    },
};

Modal.setAppElement('#root');

const LeaveStatusModal = ({ isOpen, onRequestClose, leaveId, leaveStatusDetails }) => {
    const getStatusIcon = (status) => {
        const lowerCaseStatus = status?.toLowerCase();
        if (lowerCaseStatus === 'pending') return <FontAwesomeIcon icon={faClock} />;
        if (lowerCaseStatus === 'approved') return <FontAwesomeIcon icon={faCheckCircle} />;
        if (lowerCaseStatus === 'rejected' || lowerCaseStatus === 'cancelled') return <FontAwesomeIcon icon={faTimesCircle} />;
        return <FontAwesomeIcon icon={faExclamationCircle} />; // Default
    };

    return (
        <Modal
            isOpen={isOpen}
            onRequestClose={onRequestClose}
            style={customStyles}
            contentLabel={`Status for Leave ID ${leaveId}`}
        >
            <h2 className="modal-title">Leave Status - Request ID: {leaveId}</h2>
            {leaveStatusDetails === null ? (
                <p className="modal-loading-text">Loading status details...</p>
            ) : leaveStatusDetails && leaveStatusDetails.length > 0 ? (
                <div className="status-timeline-container">
                    {leaveStatusDetails.map((status) => ( // Removed index as it's not used
                        <div className="status-item" key={status.id}>
                            <div className={`status-icon ${status.approval_status?.toLowerCase().replace(' ', '-')}`}>
                                {getStatusIcon(status.approval_status)}
                            </div>
                            <div className="status-details">
                                {/* Display name and role as requested */}
                                <div className="status-role">
                                    {status.name} ({status.approver_role})
                                </div>
                                <div className="status-status">Status: {status.approval_status}</div>
                                {status.approval_reason && <div className="status-reason">Reason: {status.approval_reason}</div>}
                                {status.approved_at && (
                                    <div className="status-approved-at">
                                        Approved At: {new Date(status.approved_at).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="modal-message">No status details available for this leave request.</p>
            )}
            <div className="modal-actions">
                <button onClick={onRequestClose} className="modal-btn cancel">Close</button>
            </div>
        </Modal>
    );
};

export default LeaveStatusModal;