import React from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Layout.css";

const HRLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const isActive = (path) => location.pathname.includes(path);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="layout-container">
      <aside className="sidebar">
        <h2 className="sidebar-title">HR Panel</h2>
        <nav>
          <ul>
            <li className={isActive("/dashboard") ? "active" : ""}>
              <Link to="/hr/dashboard">Dashboard</Link>
            </li>
            <li className={isActive("/leave-request") ? "active" : ""}>
              <Link to="/hr/leave-request">Leave</Link>
            </li>
            <li className={isActive("/approve-leaves") ? "active" : ""}>
              <Link to="/hr/approve-leaves">Approve Leaves</Link>
            </li>
            <li className={isActive("/view-employees") ? "active" : ""}>
              <Link to="/hr/view-employees">View Employees</Link>
            </li>
            <li className={isActive("/holiday") ? "active" : ""}>
              <Link to="/hr/holiday">Holidays</Link>
            </li>
            <li className={isActive("/calender") ? "active" : ""}>
              <Link to="/hr/calender">Calender</Link>
            </li>
          </ul>
        </nav>

        <div className="logout-section">
          <button className="logout-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="top-bar">
          <h1></h1>
          <Link to="/hr/view-profile" className="profile-link">
            My Profile
          </Link>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default HRLayout;
