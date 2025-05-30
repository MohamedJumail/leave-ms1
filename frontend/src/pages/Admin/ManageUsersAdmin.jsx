// ManageUsers.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import ConfirmModal from '../../components/ConfirmModal';
import './ManageUsersAdmin.css';

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
          <button type="submit" className="updater-btn">Update</button>
          <button type="button" className="cancelr-btn" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  );
};

const ManageUsersAdmin = () => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Array.isArray(response.data)) {
        setUsers(response.data);
      } else {
        console.error("Unexpected users data:", response.data);
        setUsers([]);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
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
      alert('Failed to delete user. Please try again.');
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
      alert('Failed to update user. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Blur all content when editingUser is set */}
      <div className={`page-content ${editingUser ? 'blurred' : ''}`}>
        <div className="manage-users">
          <div className="card">
            <div className="header-row">
              <h2>Manage Users</h2>
              <input
                type="text"
                placeholder="Search by name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="search-box"
              />
            </div>

            {loading ? (
              <p className="status-text">Loading users...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="status-text">No users found.</p>
            ) : (
              <>
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>{user.role}</td>
                        <td>
                          <button
                            className="update-btn"
                            onClick={() => handleEditClick(user)}
                          >
                            Update
                          </button>{' '}
                          <button
                            className="delete-btn"
                            onClick={() => confirmDelete(user.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>

        {showModal && (
          <ConfirmModal
            message="Are you sure you want to delete this user?"
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelDelete}
          />
        )}
      </div>

      {/* Modal overlay for editing user */}
      {editingUser && (
        <div className="edit-user-modal">
          <EditUserCard
            user={editingUser}
            onUpdate={handleUpdateUser}
            onCancel={handleCancelEdit}
          />
        </div>
      )}
    </>
  );
};

export default ManageUsersAdmin;
