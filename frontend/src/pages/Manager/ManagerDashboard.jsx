import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import '../Employee/EmployeeDashboard.css';

const ManagerDashboard = () => {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [teamLeaveStatus, setTeamLeaveStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [profileRes, balancesRes, statusRes] = await Promise.all([
          api.get('/api/users/profile', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          api.get('/api/leave-balances', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          api.get('/api/team-leave-status', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        setProfile(profileRes.data);
        setLeaveBalances(balancesRes.data);
        setTeamLeaveStatus(statusRes.data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard info');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [token]);

  if (loading) return <p className="dashboard-loading">Loading dashboard...</p>;
  if (error) return <p className="dashboard-error">{error}</p>;
  if (!profile) return <p className="dashboard-error">Profile not found.</p>;

  return (
    <div className="dashboard-container">
      <h1>Welcome, {profile.name}!</h1>
      <p><strong>Role:</strong> {profile.role}</p>
      <p><strong>Department:</strong> {profile.department || 'N/A'}</p>

      <hr className="dashboard-separator" />

      <h2>Your Leave Balances</h2>
      {leaveBalances.length === 0 ? (
        <p>No leave balances available.</p>
      ) : (
        <ul className="leave-balance-list">
          {leaveBalances.map((leave) => (
            <li key={leave.leave_type}>
              <strong>{leave.leave_type}:</strong> {leave.balance} days
            </li>
          ))}
        </ul>
      )}

      <hr className="dashboard-separator" />
      <h2>Team Leave Status Today</h2>
      {teamLeaveStatus.length === 0 ? (
        <p>No team members found.</p>
      ) : (
        <table className="team-leave-status">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {teamLeaveStatus.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>{member.department}</td>
                <td>
                  {member.onLeave ? (
                    <span className="on-leave">On Leave</span>
                  ) : (
                    <span className="available">Available</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ManagerDashboard;
