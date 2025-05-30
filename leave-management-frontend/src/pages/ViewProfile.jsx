import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import '../styles/ViewProfile.css';

const ViewProfile = () => {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/api/users/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setProfile(response.data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordMsg('');

    try {
      const response = await api.put(
        '/api/users/change-password',
        {
          currentPassword,
          newPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setPasswordMsg(response.data.msg || 'Password updated!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      console.error(err);
      setPasswordMsg(
        err.response?.data?.msg || 'Failed to update password'
      );
    }
  };

  if (loading) return <p className="vp-loading">Loading profile...</p>;
  if (!profile) return <p className="vp-error">Could not load profile.</p>;

  return (
    <div className="vp-card">
      <h2 className="vp-title">Your Profile</h2>
      <p><strong>Name:</strong> {profile.name}</p>
      <p><strong>Email:</strong> {profile.email}</p>
      <p><strong>Role:</strong> {profile.role}</p>
      <p><strong>Department:</strong> {profile.department || 'N/A'}</p>
      {profile.manager_id && <p><strong>Manager ID:</strong> {profile.manager_id}</p>}
      {profile.hr_id && <p><strong>HR ID:</strong> {profile.hr_id}</p>}

      <hr className="vp-separator" />

      {!showChangePassword ? (
        <button
          className="vp-button"
          onClick={() => {
            setPasswordMsg('');
            setShowChangePassword(true);
          }}
          style={{ marginTop: '1rem' }}
        >
          Update Password
        </button>
      ) : (
        <>
          <h3 className="vp-subtitle">Change Password</h3>
          <form onSubmit={handlePasswordChange} className="vp-form">
            <div className="vp-form-group">
              <label htmlFor="currentPassword" className="vp-label">
                Current Password:
              </label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="vp-input"
              />
            </div>
            <div className="vp-form-group">
              <label htmlFor="newPassword" className="vp-label">
                New Password:
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="vp-input"
              />
            </div>
            <button type="submit" className="vp-button">
              Update Password
            </button>
            <button
              type="button"
              className="vp-button"
              style={{ backgroundColor: '#888' }}
              onClick={() => {
                setShowChangePassword(false);
                setPasswordMsg('');
                setCurrentPassword('');
                setNewPassword('');
              }}
            >
              Cancel
            </button>
            {passwordMsg && <p className="vp-password-msg">{passwordMsg}</p>}
          </form>
        </>
      )}
    </div>
  );
};

export default ViewProfile;
