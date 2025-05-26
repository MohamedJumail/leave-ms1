import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const isActive = (path) => location.pathname.includes(path);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  const goToProfile = () => {
    setMenuOpen(false);
    navigate('/admin/profile');
  };

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <h2 className="sidebar-title">Admin Panel</h2>
        <nav>
          <ul className="sidebar-nav-list">
            <li className={`sidebar-nav-item ${isActive('/admin/manage-users') ? 'active' : ''}`}>
              <Link to="/admin/manage-users">Manage Users</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive('/admin/create-user') ? 'active' : ''}`}>
              <Link to="/admin/create-user">Create User</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive('/admin/create-holiday') ? 'active' : ''}`}>
              <Link to="/admin/create-holiday">Create Holidays</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive('/admin/leave-types') ? 'active' : ''}`}>
              <Link to="/admin/leave-types">Leave Types</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive('/admin/leave-approvals') ? 'active' : ''}`}>
              <Link to="/admin/leave-approvals">Leave Approvals</Link>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <h1 className="page-title"></h1>
          <div className="profile-menu-container">
            <button className="menu-icon" onClick={toggleMenu}>
              &#9776;
            </button>
            {menuOpen && (
              <div className="dropdown-menu">
                <button onClick={goToProfile}>View Profile</button>
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        </div>

        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
