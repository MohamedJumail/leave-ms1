// src/components/RejectReasonModal.jsx
import React, { useState } from 'react';
import './RejectReasonModal.css'; // Create this CSS file

const RejectReasonModal = ({ isOpen, onRequestClose, onConfirmReject, requestId }) => {
  const [rejectionReason, setRejectionReason] = useState('');

  const handleConfirm = () => {
    onConfirmReject(requestId, rejectionReason);
    setRejectionReason(''); // Clear reason after submission
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <p className="modal-message">Please provide a reason for rejection:</p>
        <textarea
          className="modal-textarea"
          value={rejectionReason}
          onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="Enter rejection reason..."
        />
        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onRequestClose}>Cancel</button>
          <button
            className="modal-btn reject"
            onClick={handleConfirm}
            disabled={!rejectionReason.trim()}
          >
            Confirm Reject
          </button>
        </div>
      </div>
    </div>
  );
};

export default RejectReasonModal;