import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import '../styles/ManageUsers.css';

const EditUserCard = ({ user, onUpdate, onCancel }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    role: user.role || '',
    manager_id: user.manager_id || '',
    hr_id: user.hr_id || '',
    department: user.department || '',
  });

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(formData);
  };

  return (
    <div className="edit-user-card">
      <h3>Edit User</h3>
      <form onSubmit={handleSubmit}>
        <label>
          Name
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </label>
        <label>
          Email
          <input
            name="email"
            value={formData.email}
            onChange={handleChange}
            type="email"
            required
          />
        </label>
        <label>
          Role
          <select name="role" value={formData.role} onChange={handleChange} required>
            <option value="">Select Role</option>
            <option value="Admin">Admin</option>
            <option value="HR">HR</option>
            <option value="Manager">Manager</option>
            <option value="Employee">Employee</option>
          </select>
        </label>
        <label>
          Manager ID
          <input
            name="manager_id"
            value={formData.manager_id}
            onChange={handleChange}
            type="number"
          />
        </label>
        <label>
          HR ID
          <input
            name="hr_id"
            value={formData.hr_id}
            onChange={handleChange}
            type="number"
          />
        </label>
        <label>
          Department
          <input
            name="department"
            value={formData.department}
            onChange={handleChange}
          />
        </label>
        <div className="edit-user-actions">
          <button type="submit" className="update-btn admin-update-btn">Update</button>
          <button type="button" className="cancel-btn" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

const ManageUsers = () => {
  const { token, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [viewAll, setViewAll] = useState(false);

  const leaveTypes = {
    1: "Casual Leave",
    2: "Sick Leave",
    3: "Earned Leave",
  };

  useEffect(() => {
    fetchUsers();
  }, [token, viewAll]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let endpoint = '/api/users';
      const response = await api.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let filteredUsers = response.data || [];

      // Filter users based on role
      if (!viewAll && user?.role !== 'Admin') {
        if (user?.role === 'HR') {
          filteredUsers = filteredUsers.filter(u => u.hr_id === user.id);
        } else if (user?.role === 'Manager') {
          filteredUsers = filteredUsers.filter(u => u.manager_id === user.id);
        }
      }

      setUsers(filteredUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveDetails = async (userId) => {
    try {
      let pendingEndpoint = '/api/leave/my-pending-requests';
      if (user?.role === 'Admin' || user?.role === 'HR') {
        pendingEndpoint = '/api/leave/admin-view-pending';
      }

      const [balanceRes, pendingRes] = await Promise.all([
        api.get(`/api/leave-balances/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        api.get(`${pendingEndpoint}/${userId}`, {
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
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (selectedUserId) {
        fetchLeaveDetails(selectedUserId);
      }
    } catch (error) {
      console.error(`Error ${decision.toLowerCase()} leave request:`, error);
    }
  };

  const confirmDelete = (userId) => {
    setSelectedUserId(userId);
    setShowModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUserId) return;
    try {
      await api.delete(`/api/users/${selectedUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    } finally {
      setShowModal(false);
      setSelectedUserId(null);
    }
  };

  const handleCancelDelete = () => {
    setShowModal(false);
    setSelectedUserId(null);
  };

  const handleEditClick = (user) => {
    setEditingUser(user);
  };

  const handleUpdateUser = async (updatedData) => {
    try {
      await api.put(`/api/users/${editingUser.id}`, updatedData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchUsers();
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
  };

  const filteredUsers = users.filter(u =>
    u?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Role-specific UI components
  const renderAdminActions = (userId) => (
    <div className="button-group">
      <button
        className="admin-update-btn"
        onClick={() => handleEditClick(users.find(u => u.id === userId))}
      >
        Update
      </button>
      <button
        className="admin-delete-btn"
        onClick={() => confirmDelete(userId)}
      >
        Delete
      </button>
    </div>
  );

  const renderHRManagerActions = (userId) => (
    <button className="btn-view-details" onClick={() => fetchLeaveDetails(userId)}>
      View Details
    </button>
  );

  const renderViewAllToggle = () => (
    user?.role === 'HR' && (
      <div className="view-all-toggle-container">
        <label className="view-all-toggle">
          <input
            type="checkbox"
            checked={viewAll}
            onChange={(e) => setViewAll(e.target.checked)}
          />
          View all users
        </label>
      </div>
    )
  );

  const shouldShowDecisionColumn = () => {
    if (user?.role === 'Admin') return false;
    if ((user?.role === 'HR' && viewAll) || user?.role === 'Manager') return true;
    return false;
  };

  return (
    <div className="view-users-container">
      {/* Blur content when editing */}
      <div className={`page-content ${editingUser ? 'blurred' : ''}`}>
        <div className="user-list-section">
          <h2>
            {user?.role === 'Admin' ? 'Manage Users' :
              user?.role === 'HR' ? 'Team Members (HR View)' : 'Team Members (Manager View)'}
          </h2>
          <div className="search-and-toggle">
            <input
              type="text"
              placeholder={`Search by ${user?.role === 'Admin' ? 'name or email' : 'name'}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="user-search-input"
            />
            {user?.role === 'HR' && renderViewAllToggle()}
          </div>
        </div>

        {loading ? (
          <p className="loading-text">Loading users...</p>
        ) : filteredUsers.length === 0 ? (
          <p className="no-users">No users found.</p>
        ) : (
          <table className="user-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                {user?.role === 'Admin' && <th>Department</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  {user?.role === 'Admin' && <td>{u.department}</td>}
                  <td>
                    {user?.role === 'Admin'
                      ? renderAdminActions(u.id)
                      : renderHRManagerActions(u.id)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Delete confirmation modal */}
        {showModal && (
          <ConfirmModal
            message="Are you sure you want to delete this user?"
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelDelete}
          />
        )}
      </div>

      {/* Edit user modal */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="leave-details-modal">
            <button className="btn-close-details" onClick={handleCancelEdit}>
              &times;
            </button>
            <EditUserCard
              user={editingUser}
              onUpdate={handleUpdateUser}
              onCancel={handleCancelEdit}
            />
          </div>
        </div>
      )}

      {/* Leave details modal */}
      {selectedUserId && (
        <div className="modal-overlay" onClick={() => setSelectedUserId(null)}>
          <div className="leave-details-modal" onClick={(e) => e.stopPropagation()}>
            <button className="btn-close-details" onClick={() => setSelectedUserId(null)}>
              &times;
            </button>

            <h2 className="panel-title">Leave Details</h2>

            {/* Leave Balances */}
            <div className="leave-balance-section">
              <h3>Leave Balances</h3>
              {leaveBalances.length > 0 ? (
                <table className="leave-balance-table">
                  <thead>
                    <tr>
                      <th>Leave Type</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveBalances.map((b) => (
                      <tr key={b.id}>
                        <td>{b.leave_type || leaveTypes[b.leave_type_id]}</td>
                        <td>{b.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>No balances found.</p>
              )}
            </div>

            {/* Pending Requests */}
            <div className="pending-leaves-section">
              <h3>Pending Leave Requests</h3>
              {pendingLeaves.length > 0 ? (
                <table className="pending-leaves-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Days</th>
                      <th>Status</th>
                      {(user?.role === 'Admin' || user?.role === 'HR') && <th>Next Decision</th>}
                      {shouldShowDecisionColumn() && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pendingLeaves.map((leave) => {
                      const from = new Date(leave.start_date);
                      const to = new Date(leave.end_date);
                      const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

                      return (
                        <tr key={leave.id}>
                          <td>{leaveTypes[leave.leave_type_id] || leave.leave_type_id}</td>
                          <td>{from.toLocaleDateString()}</td>
                          <td>{to.toLocaleDateString()}</td>
                          <td>{days}</td>
                          <td>{leave.status}</td>
                          {(user?.role === 'Admin' || user?.role === 'HR') && <td>{leave.next_decision}</td>}
                          {shouldShowDecisionColumn() && (
                            <td>
                              <div className="button-group">
                                <button
                                  className="btn-approve"
                                  onClick={() => handleDecision(leave.id, "Approved")}
                                >
                                  Approve
                                </button>
                                <button
                                  className="btn-reject"
                                  onClick={() => handleDecision(leave.id, "Rejected")}
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p>No pending leave requests.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageUsers;