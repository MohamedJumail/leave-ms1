import React, { useState, useRef, useEffect } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Layout.css";

const HRLayout = () => {
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
    navigate("/hr/view-profile");
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
        <h2 className="sidebar-title">HR Panel</h2>
        <nav>
          <ul className="sidebar-nav-list">
            <li className={`sidebar-nav-item ${isActive("/dashboard") ? "active" : ""}`}>
              <Link to="/hr/dashboard">Dashboard</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive("/leave-request") ? "active" : ""}`}>
              <Link to="/hr/leave-request">Leave</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive("/approve-leaves") ? "active" : ""}`}>
              <Link to="/hr/approve-leaves">Approve Leaves</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive("/view-employees") ? "active" : ""}`}>
              <Link to="/hr/view-employees">View Employees</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive("/holiday") ? "active" : ""}`}>
              <Link to="/hr/holiday">Holidays</Link>
            </li>
            <li className={`sidebar-nav-item ${isActive("/calender") ? "active" : ""}`}>
              <Link to="/hr/calender">Calender</Link>
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

export default HRLayout;
