import React, { useState, useRef, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Layout.css";

const ManagerLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const isActive = (path) => location.pathname.includes(path);

  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleMenu = () => {
    setMenuOpen((prev) => !prev);
  };

  const goToProfile = () => {
    setMenuOpen(false);
    navigate("/manager/view-profile");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <h2 className="sidebar-title">Manager Panel</h2>
        <nav>
          <ul className="sidebar-nav-list">
            <li className={`sidebar-nav-item ${isActive("/dashboard") ? "active" : ""}`}>
              <Link to="/manager/dashboard">Dashboard</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive("/view-teams") ? "active" : ""}`}>
              <Link to="/manager/view-teams">View Teams</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive("/approve-leave-requests") ? "active" : ""}`}>
              <Link to="/manager/approve-leave-requests">Approve Requests</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive("/leave-request") ? "active" : ""}`}>
              <Link to="/manager/leave-request">Leave</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive("/holiday") ? "active" : ""}`}>
              <Link to="/manager/holiday">Holidays</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive("/calender") ? "active" : ""}`}>
              <Link to="/manager/calender">Calender</Link>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <h1 className="page-title"></h1>

          {/* Hamburger menu and dropdown */}
          <div className="profile-menu-container" ref={dropdownRef}>
            <button className="menu-icon" onClick={toggleMenu} aria-label="Toggle menu">
              &#9776;
            </button>
            {menuOpen && (
              <div className="dropdown-menu">
                <button onClick={goToProfile}>My Profile</button>
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

export default ManagerLayout;
