import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Auth page
import LoginPage from './pages/Auth/LoginPage';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import HRLayout from './layouts/HRLayout';
import EmployeeLayout from './layouts/EmployeeLayout';
import ManagerLayout from './layouts/ManagerLayout';

// Dashboards
import AdminDashboard from './pages/Admin/AdminDashboard';
import HRDashboard from './pages/HR/HRDashboard';
import EmployeeDashboard from './pages/Employee/EmployeeDashboard';
import ManagerDashboard from './pages/Manager/ManagerDashboard';
//Admin
import ManageUsers from './pages/Admin/ManageUsers';
import CreateUser from './pages/Admin/CreateUser'
import AddHoliday from './pages/Admin/AddHoliday';
import LeaveTypes from './pages/Admin/LeaveTypes';
import LeaveApproval from './pages/Admin/LeaveApproval';
//Manager
import ViewProfiles from './pages/Manager/ViewProfile';
import Leaves from './pages/Manager/Leave';
import Holidays from './pages/Manager/AddHoliday';
import ViewUsers from './pages/Manager/ViewUsers';
import PendingLeaveRequests from './pages/Manager/PendingLeaveRequests';
import CalendarViewM from './pages/Manager/CalenderView';
//HR
import ViewProfileHR from './pages/HR/ViewProfile';
import LeaveHR from './pages/HR/Leave';
import HolidayHR from './pages/HR/AddHoliday';
import ViewUsersHR from './pages/HR/ViewUsers';
import PendingLeaveRequestsHR from './pages/HR/PendingLeaveRequests';
import CalendarViewHR from './pages/HR/CalenderView';
//Employee
import ViewProfile from './pages/Employee/ViewProfile';
import Leave from './pages/Employee/Leave';
import Holiday from './pages/Employee/AddHoliday';
import CalendarView from './pages/Employee/CalenderView';
// ProtectedRoute wrapper
import ProtectedRoute from './components/ProtectedRoute';
import MyCalendar from './pages/Employee/CalenderView';






const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public route */}
          <Route path="/" element={<LoginPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Admin routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute requiredRole="Admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="manage-users" element={<ManageUsers />} />
            <Route path="create-user" element={<CreateUser />} />
            <Route path="create-holiday" element={<AddHoliday />} />
            <Route path="leave-types" element={<LeaveTypes />} />
            <Route path="leave-approvals" element={<LeaveApproval />} />
          </Route>

          {/* HR routes */}
          <Route
            path="/hr/*"
            element={
              <ProtectedRoute requiredRole="HR">
                <HRLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<HRDashboard />} />
            <Route path="view-profile" element={<ViewProfileHR />} />
            <Route path="leave-request" element={<LeaveHR />} />
            <Route path="holiday" element={<HolidayHR />} />
            <Route path="view-employees" element={<ViewUsersHR/>} />
            <Route path="approve-leaves" element={<PendingLeaveRequestsHR/>} />
            <Route path="calender" element={<CalendarViewHR />} />
          </Route>

          {/* Manager routes */}
          <Route
            path="/manager/*"
            element={
              <ProtectedRoute requiredRole="Manager">
                <ManagerLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<ManagerDashboard />} />
            <Route path="view-profile" element={<ViewProfiles />} />
            <Route path="leave-request" element={<Leaves />} />
            <Route path="holiday" element={<Holidays />} />
            <Route path="view-teams" element={<ViewUsers/>} />
            <Route path="approve-leave-requests" element={<PendingLeaveRequests/>} />
            <Route path="calender" element={<CalendarViewM />} />
          </Route>

          {/* Employee routes */}
          <Route
            path="/employee/*"
            element={
              <ProtectedRoute requiredRole="Employee">
                <EmployeeLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<EmployeeDashboard />} />
            <Route path="view-profile" element={<ViewProfile />} />
            <Route path="leave-request" element={<Leave />} />
            <Route path="holiday" element={<Holiday />} />
            <Route path="calender" element={<MyCalendar />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
