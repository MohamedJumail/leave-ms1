import React from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Layout.css"; // Reuse the same dark theme layout styles

const ManagerLayout = () => {
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
        <h2 className="sidebar-title">Manager Panel</h2>
        <nav>
          <ul>
          <li className={isActive("/dashboard") ? "active" : ""}>
              <Link to="/manager/dashboard">Dashboard</Link>
            </li>
            <li className={isActive("/view-teams") ? "active" : ""}>
              <Link to="/manager/view-teams">View Teams</Link>
            </li>
            <li className={isActive("/approve-leave-requests") ? "active" : ""}>
              <Link to="/manager/approve-leave-requests">
                Approve Requests
              </Link>
            </li>
            <li className={isActive("/leave-request") ? "active" : ""}>
              <Link to="/manager/leave-request">Leave</Link>
            </li>
            <li className={isActive("/holiday") ? "active" : ""}>
              <Link to="/manager/holiday">Holidays</Link>
            </li>
            <li className={isActive('/calender') ? 'active' : ''}>
              <Link to="/manager/calender">Calender</Link>
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
          <Link to="/manager/view-profile" className="profile-link">
            View Profile
          </Link>
        </div>
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default ManagerLayout;
