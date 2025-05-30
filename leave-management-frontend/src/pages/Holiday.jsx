import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../styles/Holiday.css';

const Holiday = () => {
  const { token, user } = useAuth(); // Get user object
  const [holidayName, setHolidayName] = useState('');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidays, setHolidays] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      const response = await api.get('/holidays', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const dbReturned = response.data.holidays;
      const holidaysArray = Array.isArray(dbReturned) && Array.isArray(dbReturned[0])
        ? dbReturned[0]
        : [];

      setHolidays(holidaysArray);
    } catch (err) {
      console.error('Error fetching holidays:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post(
        '/holidays',
        { name: holidayName, date: holidayDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert('Holiday added successfully');
        setHolidayName('');
        setHolidayDate('');
        fetchHolidays();
      }
    } catch (error) {
      console.error('Error adding holiday:', error);
      setError('Failed to add holiday. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;

    try {
      await api.delete(`/holidays/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      console.error('Error deleting holiday:', err);
      alert('Failed to delete holiday.');
    }
  };

  const filteredHolidays = holidays.filter(
    (holiday) =>
      holiday?.name && holiday.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="add-holiday-container">
      {user?.role === 'Admin' && (
        <div className="add-holiday-card">
          <h2>Add Holiday</h2>
          <form onSubmit={handleSubmit}>
            <div className="add-holiday-form-group">
              <label htmlFor="holidayName" className="add-holiday-label">Holiday Name</label>
              <input
                type="text"
                id="holidayName"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="Enter holiday name"
                className="add-holiday-input"
                required
              />
            </div>
            <div className="add-holiday-form-group">
              <label htmlFor="holidayDate" className="add-holiday-label">Holiday Date</label>
              <input
                type="date"
                id="holidayDate"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                className="add-holiday-input"
                required
              />
            </div>
            {error && <p className="add-holiday-error-text">{error}</p>}
            <button type="submit" className="add-holiday-submit-btn" disabled={loading}>
              {loading ? 'Adding...' : 'Add Holiday'}
            </button>
          </form>
        </div>
      )}

      <div className="holiday-list-section">
        <h2>Holiday List</h2>
        <input
          type="text"
          className="add-holiday-search"
          placeholder="Search holidays..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <table className="add-holiday-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Date</th>
              {user?.role === 'Admin' && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {filteredHolidays.length > 0 ? (
              filteredHolidays.map((holiday) => (
                <tr key={holiday.id}>
                  <td>{holiday.name}</td>
                  <td>{new Date(holiday.date).toLocaleDateString()}</td>
                  {user?.role === 'Admin' && (
                    <td>
                      <button
                        className="add-holiday-delete-btn"
                        onClick={() => handleDelete(holiday.id)}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={user?.role === 'Admin' ? 3 : 2} className="no-holidays">
                  No holidays found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Holiday;
