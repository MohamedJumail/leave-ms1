// src/pages/Auth/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import './LoginPage.css';  // Add this CSS file for the login page styles

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, error, setError, user, token } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Clear any previous error
    await login(email, password); // Attempt login
  };

  useEffect(() => {
    if (token && user?.role) {
      const role = user.role.toLowerCase();
      const dashboardPaths = {
        admin: "/admin/dashboard",
        hr: "/hr/dashboard",
        manager: "/manager/dashboard",
        employee: "/employee/dashboard",
      };
      const path = dashboardPaths[role] || "/";
      navigate(path); // Redirect user to their respective dashboard
    }
  }, [user, token, navigate]);

  return (
    <div className="login-page">
      <div className="login-container">
        <h2 className="login-title">Login</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            className="input-field"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            className="input-field"
          />
          <button type="submit" className="login-btn">Login</button>
        </form>
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
};

export default LoginPage;
