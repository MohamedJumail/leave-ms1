// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";

import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import ManageUsers from "./pages/ManageUsers";
import CreateUser from "./pages/CreateUser";
import LeaveTypes from "./pages/LeaveTypes";
import LeaveApproval from "./pages/LeaveApproval";
import ViewProfile from "./pages/ViewProfile";
import Holiday from "./pages/Holiday";
import Calendar from "./pages/Calendar";
import Leave from "./pages/Leave";
import CommonLayout from './layouts/CommonLayout';
import ManageUsersAdmin from "./pages/ManageUsersAdmin";

const App = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<LoginPage />} />

        {/* Protected Routes inside CommonLayout */}
        <Route path="/" element={<CommonLayout />}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="manage-users-admin" element={<ManageUsersAdmin />} />
          <Route path="manage-users" element={<ManageUsers />} />
          <Route path="create-user" element={<CreateUser />} />
          <Route path="leave-types" element={<LeaveTypes />} />
          <Route path="leave-approvals" element={<LeaveApproval />} />
          <Route path="profile" element={<ViewProfile />} />
          <Route path="holiday" element={<Holiday />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="leave-request" element={<Leave />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
};

export default App;
