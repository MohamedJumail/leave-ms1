import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../styles/LeaveTypes.css';
const LeaveTypes = () => {
  const { token } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    max_days: '',
    apply_before_days: '',
    carry_forward: false,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLeaveTypes();
  }, [token]);

  const fetchLeaveTypes = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/leave-types', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Array.isArray(response.data)) {
        setLeaveTypes(response.data);
      } else {
        console.error('Unexpected leave types data:', response.data);
        setLeaveTypes([]);
      }
    } catch (error) {
      console.error('Error fetching leave types:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic frontend validation
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }

    const payload = {
      name: formData.name.trim(), // Trim to remove extra spaces
      max_days: Number(formData.max_days),
      apply_before_days: Number(formData.apply_before_days),
      carry_forward: formData.carry_forward,
    };

    console.log('Submitting formData:', payload);

    try {
      await api.post('/api/leave-types', payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      fetchLeaveTypes(); // Refresh list
      setFormData({
        name: '',
        max_days: '',
        apply_before_days: '',
        carry_forward: false,
      });
    } catch (error) {
      console.error('Error adding leave type:', error);
      if (error.response && error.response.data) {
        alert(`Error: ${error.response.data.msg || 'Invalid data'}`);
      }
    }
  };

  const filteredLeaveTypes = leaveTypes.filter(
    (leaveType) =>
      leaveType.name.toLowerCase().includes(search.toLowerCase()) ||
      leaveType.max_days.toString().includes(search)
  );

  return (
    <div className="leave-types">
      <div className="card">
        <h2 className="head">Add a Leave Type</h2>
        <form onSubmit={handleSubmit} className="add-form">
          <label>
            Name:
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </label>
          <label>
            Max Days:
            <input
              type="number"
              name="max_days"
              value={formData.max_days}
              onChange={handleChange}
              required
              min="1"
            />
          </label>
          <label>
            Apply Before Days:
            <input
              type="number"
              name="apply_before_days"
              value={formData.apply_before_days}
              onChange={handleChange}
              required
              min="0"
            />
          </label>
          <label>
            Carry Forward:
            <input
              type="checkbox"
              name="carry_forward"
              checked={formData.carry_forward}
              onChange={handleChange}
            />
          </label>
          <button type="submit">Add Leave Type</button>

          <div className="header-row">
            <h2>Leave Types</h2>
            <input
              type="text"
              placeholder="Search by name or max days"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-box"
            />
          </div>
        </form>

        {loading ? (
          <p>Loading leave types...</p>
        ) : filteredLeaveTypes.length === 0 ? (
          <p>No leave types found.</p>
        ) : (
          <table className="leave-types-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Max Days</th>
                <th>Apply Before Days</th>
                <th>Carry Forward</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaveTypes.map((leaveType) => (
                <tr key={leaveType.id}>
                  <td>{leaveType.name}</td>
                  <td>{leaveType.max_days}</td>
                  <td>{leaveType.apply_before_days}</td>
                  <td>{leaveType.carry_forward ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LeaveTypes;
