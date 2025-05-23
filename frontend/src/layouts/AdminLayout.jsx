// src/layouts/AdminLayout.jsx
import React from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth(); // ✅ get logout from context

  const isActive = (path) => location.pathname.includes(path);

  const handleLogout = () => {
    logout();               // ✅ clear user/token from context
    navigate('/login');     // ✅ redirect to login page
  };

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <h2 className="sidebar-title">Admin Panel</h2>
        <nav>
          <ul>
            <li className={isActive('/admin/manage-users') ? 'active' : ''}>
              <Link to="/admin/manage-users">Manage Users</Link>
            </li>
            <li className={isActive('/admin/create-user') ? 'active' : ''}>
              <Link to="/admin/create-user">Create User</Link>
            </li>
            <li className={isActive('/admin/create-holiday') ? 'active' : ''}>
              <Link to="/admin/create-holiday">Create Holidays</Link>
            </li>
            <li className={isActive('/admin/leave-types') ? 'active' : ''}>
              <Link to="/admin/leave-types">Leave Types</Link>
            </li>
            <li className={isActive('/admin/leave-approvals') ? 'active' : ''}>
              <Link to="/admin/leave-approvals">Leave Approvals</Link>
            </li>
          </ul>
        </nav>

        {/* ✅ Logout button */}
        <div className="logout-section">
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="page-header">
          <h1>Welcome to the Admin Panel</h1>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
