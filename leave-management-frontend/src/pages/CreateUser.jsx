import React, { useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import api from '../services/api'; // ✅ Axios instance
import '../styles/CreateUser.css';

const CreateUser = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    manager_id: '',
    hr_id: '',
    department: '',
  });

  const [showModal, setShowModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState(''); // ✅ State for success message

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setShowModal(true);
  };

  const handleConfirm = async () => {
    setShowModal(false);
    try {
      const token = localStorage.getItem('token');
  
      // Convert empty strings to null for manager_id and hr_id
      const sanitizedData = {
        ...formData,
        manager_id: formData.manager_id.trim() === '' ? null : formData.manager_id,
        hr_id: formData.hr_id.trim() === '' ? null : formData.hr_id,
      };
  
      const res = await api.post('/api/users', sanitizedData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      setSuccessMessage(`User created with ID: ${res.data.userId}`);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: '',
        manager_id: '',
        hr_id: '',
        department: '',
      });
    } catch (err) {
      console.error('Error creating user:', err);
      const message = err.response?.data?.msg || 'Something went wrong';
      setSuccessMessage(`Error: ${message}`);
    }
  };  
  const handleCancel = () => {
    setShowModal(false);
  };

  return (
    <div className="create-user-container">
      <h2>Create New User</h2>
      <form className="create-user-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="name"
          value={formData.name}
          placeholder="Full Name"
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          value={formData.email}
          placeholder="Email Address"
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          value={formData.password}
          placeholder="Password"
          onChange={handleChange}
          required
        />
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          required
        >
          <option value="">Select Role</option>
          <option value="Admin">Admin</option>
          <option value="HR">HR</option>
          <option value="Manager">Manager</option>
          <option value="Employee">Employee</option>
        </select>

        <input
          type="text"
          name="manager_id"
          value={formData.manager_id}
          placeholder="Manager ID "
          onChange={handleChange}
        />

        <input
          type="text"
          name="hr_id"
          value={formData.hr_id}
          placeholder="HR ID "
          onChange={handleChange}
        />

        <input
          type="text"
          name="department"
          value={formData.department}
          placeholder="Department"
          onChange={handleChange}
        />

        <button type="submit">Create User</button>

        {/* ✅ Message shown below button */}
        {successMessage && <p className="success-msg">{successMessage}</p>}
      </form>

      {showModal && (
        <ConfirmModal
          message="Are you sure you want to create this user?"
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
};

export default CreateUser;
