import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Layout.css';

const menus = {
  admin: [
    { to: '/manage-users-admin', label: 'Manage Users' },
    { to: '/create-user', label: 'Create User' },
    { to: '/holiday', label: 'Create Holidays' },
    { to: '/leave-types', label: 'Leave Types' },
    { to: '/leave-approvals', label: 'Leave Approvals' },
  ],
  employee: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/leave-request', label: 'Leave' },
    { to: '/holiday', label: 'Holidays' },
    { to: '/calendar', label: 'Calendar' },
  ],
  hr: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/leave-request', label: 'Leave' },
    { to: '/leave-approvals', label: 'Approve Leaves' },
    { to: '/manage-users', label: 'View Employees' },
    { to: '/holiday', label: 'Holidays' },
    { to: '/calendar', label: 'Calendar' },
  ],
  manager: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/manage-users', label: 'View Teams' },
    { to: '/leave-approvals', label: 'Approve Requests' },
    { to: '/leave-request', label: 'Leave' },
    { to: '/holiday', label: 'Holidays' },
    { to: '/calendar', label: 'Calendar' },
  ],
};

const panelTitles = {
  admin: 'Admin Panel',
  employee: 'Employee Panel',
  hr: 'HR Panel',
  manager: 'Manager Panel',
};

const CommonLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role?.toLowerCase() || 'employee';

  const isActive = (path) => location.pathname === path;

  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const goToProfile = () => {
    setMenuOpen(false);
    navigate('/profile');
  };

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.profile-menu-container')) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <h2 className="sidebar-title">{panelTitles[role]}</h2>
        <nav>
          <ul className="sidebar-nav-list">
            {menus[role].map(({ to, label }) => (
              <li
                key={to}
                className={`sidebar-nav-item ${isActive(to) ? 'active' : ''}`}
              >
                <Link to={to}>{label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <h1 className="page-title"></h1>
          <div className="profile-menu-container">
            <button
              className="menu-icon"
              onClick={toggleMenu}
              aria-label="Toggle menu"
            >
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

export default CommonLayout;
