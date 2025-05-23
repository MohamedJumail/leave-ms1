import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './AddHoliday.css';

const Holiday = () => {
  const { token } = useAuth();
  const [holidays, setHolidays] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredHolidays = holidays.filter(
    (holiday) =>
      holiday?.name && holiday.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="add-holiday-container">
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
            </tr>
          </thead>
          <tbody>
            {filteredHolidays.length > 0 ? (
              filteredHolidays.map((holiday) => (
                <tr key={holiday.id}>
                  <td>{holiday.name}</td>
                  <td>{new Date(holiday.date).toLocaleDateString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" className="no-holidays">No holidays found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Holiday;
