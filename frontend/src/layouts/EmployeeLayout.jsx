import React, { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const EmployeeLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const isActive = (path) => location.pathname.includes(path);

  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const goToProfile = () => {
    setMenuOpen(false);
    navigate('/employee/view-profile');
  };

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <h2 className="sidebar-title">Employee Panel</h2>
        <nav>
          <ul className="sidebar-nav-list">
            <li className={`sidebar-nav-item ${isActive('/employee/dashboard') ? 'active' : ''}`}>
              <Link to="/employee/dashboard">Dashboard</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive('/employee/leave-request') ? 'active' : ''}`}>
              <Link to="/employee/leave-request">Leave</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive('/employee/holiday') ? 'active' : ''}`}>
              <Link to="/employee/holiday">Holidays</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive('/employee/calender') ? 'active' : ''}`}>
              <Link to="/employee/calender">Calender</Link>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <h1 className="page-title"></h1>
          <div className="profile-menu-container" ref={dropdownRef}>
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

export default EmployeeLayout;
