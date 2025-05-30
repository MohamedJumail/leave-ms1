const db = require("./db");

const findPendingByUserId = async (userId, role) => {
  let query = "";
  let params = [userId];

  if (role === "Manager") {
    query = `
      SELECT * FROM leave_requests
      WHERE user_id = ? AND status = 'Pending' AND manager_approval = 'Pending'
    `;
  } else if (role === "HR") {
    query = `
      SELECT * FROM leave_requests
      WHERE user_id = ? AND status = 'Pending' AND manager_approval = 'Approved' AND hr_approval = 'Pending'
    `;
  }

  const [rows] = await db.execute(query, params);
  return rows;
};
const createLeaveStatusRecords = async (leaveRequestId, leaveTypeId, managerId, hrId, directorId) => {
  const statusesToInsert = [];

  // Manager Approval
  if (managerId !== null) {
      statusesToInsert.push({
          leave_request_id: leaveRequestId,
          leave_type_id: leaveTypeId,
          approver_id: managerId,
          approver_role: 'Manager',
          approval_status: 'Pending'
      });
  }

  // HR Approval
  if (hrId !== null) {
      statusesToInsert.push({
          leave_request_id: leaveRequestId,
          leave_type_id: leaveTypeId,
          approver_id: hrId,
          approver_role: 'HR',
          approval_status: 'Pending'
      });
  }

  // Director Approval
  if (directorId !== null) {
      statusesToInsert.push({
          leave_request_id: leaveRequestId,
          leave_type_id: leaveTypeId,
          approver_id: directorId,
          approver_role: 'Director',
          approval_status: 'Pending'
      });
  }

  // Insert all status records into the leave_status table
  for (const status of statusesToInsert) {
      await db.query(
          `INSERT INTO leave_status (leave_request_id, leave_type_id, approver_id, approver_role, approval_status)
           VALUES (?, ?, ?, ?, ?)`,
          [status.leave_request_id, status.leave_type_id, status.approver_id, status.approver_role, status.approval_status]
      );
  }
};
const createLeaveRequest = async ({
  user_id,
  leave_type_id,
  start_date,
  end_date,
  reason,
}) => {
  // Step 1: Fetch user details
  const [users] = await db.query(
      `SELECT manager_id, hr_id, admin_id FROM users WHERE id = ?`,
      [user_id]
  );

  if (users.length === 0) {
      throw new Error("User not found");
  }

  const { manager_id, hr_id, admin_id } = users[0];

  // Step 2: Insert into leave_requests
  const [result] = await db.query(
      `INSERT INTO leave_requests
      (user_id, leave_type_id, start_date, end_date, reason, status, manager_approval, hr_approval, director_approval, user_status)
      VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, ?, 'Pending')`,
      [
          user_id,
          leave_type_id,
          start_date,
          end_date,
          reason,
          manager_id === null ? "Not Required" : "Pending",
          hr_id === null ? "Not Required" : "Pending",
          admin_id === null ? "Not Required" : "Pending",
      ]
  );

  const leaveRequestId = result.insertId;

  // Step 3: Create leave status records
  await createLeaveStatusRecords(leaveRequestId, leave_type_id, manager_id, hr_id, admin_id);

  return leaveRequestId;
};
// Fetch all leave requests for a user
const getLeaveRequestsByUser = async (userId) => {
  const [rows] = await db.query(
    `SELECT lr.*, lt.name AS leave_type, lr.director_approval, lr.user_status
     FROM leave_requests lr
     JOIN leave_types lt ON lr.leave_type_id = lt.id
     WHERE lr.user_id = ? 
     ORDER BY lr.created_at DESC`,
    [userId]
  );
  return rows;
};

// Fetch leave requests for subordinates based on the user's role (Manager, HR, etc.)
// Fetch leave requests for subordinates based on the user's role (Manager, HR, etc.)
const getLeaveRequestsBySubordinates = async (userId, role) => {
  let query = `
    SELECT lr.*, lt.name AS leave_type, u.name AS employee_name, lr.director_approval, lr.user_status,
           lr.manager_approval, lr.hr_approval
    FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    JOIN users u ON lr.user_id = u.id
    WHERE lr.user_status = 'Pending'
  `;

  if (role === "Manager") {
    query += ` AND lr.manager_approval = 'Pending' AND u.manager_id = ?`;
  } else if (role === "HR") {
    query += ` AND (lr.manager_approval = 'Approved' OR lr.manager_approval = 'Not Required') AND lr.hr_approval = 'Pending' AND u.hr_id = ?`;
  }

  query += ` ORDER BY lr.created_at DESC`;

  const [rows] = await db.query(query, [userId]);
  return rows;
};
// Utility to get working days excluding holidays
const getWorkingDays = async (start_date, end_date) => {
  const [holidays] = await db.query(
    `SELECT date FROM holidays WHERE date BETWEEN ? AND ?`,
    [start_date, end_date]
  );

  const holidaySet = new Set(
    holidays.map((h) => h.date.toISOString().split("T")[0])
  );

  const start = new Date(start_date);
  const end = new Date(end_date);
  let workingDays = 0;

  for (
    let date = new Date(start);
    date <= end;
    date.setDate(date.getDate() + 1)
  ) {
    const day = date.getDay();
    const formatted = date.toISOString().split("T")[0];
    if (day !== 0 && day !== 6 && !holidaySet.has(formatted)) {
      workingDays++;
    }
  }

  return workingDays;
};

const getLeaveRequestsForAdmin = async () => {
  try {
    console.log("Fetching leave requests for admin...");

    // Step 1: Fetch all pending requests where Director approval is still pending
    // but Manager and HR have already approved OR their approval is Not Required
    const [adminRelevantRequests] = await db.query(`
      SELECT 
        lr.*, 
        lt.name AS leave_type, 
        u.name AS employee_name
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN users u ON lr.user_id = u.id
      WHERE
        lr.status = 'Pending'
        AND lr.user_status = 'Pending'
        AND lr.director_approval = 'Pending'
        AND (lr.manager_approval = 'Approved' OR lr.manager_approval = 'Not Required')
        AND (lr.hr_approval = 'Approved' OR lr.hr_approval = 'Not Required')
    `);

    // Return the fetched requests
    return adminRelevantRequests;

  } catch (error) {
    console.error("Error fetching leave requests for admin:", error);
    throw error;
  }
};
const updateLeaveStatus = async ({ leaveRequestId, approverRole, approvalStatus, approvalReason = null, approverId }) => {
  await db.query(
      `UPDATE leave_status
      SET approval_status = ?, approval_reason = ?, approved_at = NOW()
      WHERE leave_request_id = ? AND approver_role = ? AND approver_id = ?`,
      [approvalStatus, approvalReason, leaveRequestId, approverRole, approverId]
  );
};

const updateLeaveApprovalByRole = async ({ leaveId, role, decision, reason, approverId }) => {
  let column;
  let approverRoleForStatus;

  if (role === "Manager") {
      column = "manager_approval";
      approverRoleForStatus = "Manager";
  } else if (role === "HR") {
      column = "hr_approval";
      approverRoleForStatus = "HR";
  } else if (role === "Admin") {
      column = "director_approval";
      approverRoleForStatus = "Director";
  } else {
      // This case should ideally be prevented by middleware, but as a safeguard
      throw new Error("Unauthorized role attempting to update leave approval.");
  }

  // 1. Update the relevant approval column in leave_requests
  if (column) {
      await db.query(`UPDATE leave_requests SET ${column} = ? WHERE id = ?`, [
          decision,
          leaveId,
      ]);

      // 2. Update the corresponding record in the leave_status table
      // This update uses the approverId of the person who just took action
      await updateLeaveStatus({
          leaveRequestId: leaveId,
          approverRole: approverRoleForStatus,
          approvalStatus: decision,
          approvalReason: reason,
          approverId, // This is the ID of the manager/HR/Admin who just acted
      });
  }

  // 3. Refetch the updated leave request to check all approval statuses
  let [[leave]] = await db.query(
      `SELECT user_id, leave_type_id, start_date, end_date,
              manager_approval, hr_approval, director_approval
       FROM leave_requests WHERE id = ?`,
      [leaveId]
  );

  // If no leave request found (e.g., invalid leaveId), handle this case
  if (!leave) {
      throw new Error(`Leave request with ID ${leaveId} not found.`);
  }

  // 4. Get working days for auto-approval logic
  const workingDays = await getWorkingDays(leave.start_date, leave.end_date);

  // 5. Get the role of the user who *applied* for the leave (applicant's role)
  // Also fetch their manager_id, hr_id, admin_id to correctly identify approvers for status table
  const [[applicantUser]] = await db.query(`SELECT role, manager_id, hr_id, admin_id FROM users WHERE id = ?`, [
      leave.user_id,
  ]);

  // ✨ Auto-approve director for <= 3 working days, ONLY for Manager and Employee applicants
  if (
      workingDays <= 3 &&
      leave.director_approval === "Pending" &&
      (applicantUser.role === "Manager" || applicantUser.role === "Employee")
  ) {
      // Update leave_requests table for director approval
      await db.query(
          `UPDATE leave_requests SET director_approval = 'Approved' WHERE id = ?`,
          [leaveId]
      );

      // Update the leave_status table for director approval (auto-approved)
      // Use the applicant's admin_id as the approver_id for this auto-approval
      await updateLeaveStatus({
          leaveRequestId: leaveId,
          approverRole: 'Director',
          approvalStatus: 'Approved',
          approvalReason: 'Auto-approved due to short leave duration.',
          approverId: applicantUser.admin_id, // Use the admin_id from the applicant's record
      });

      // Update the 'leave' object in memory to reflect the change for final status determination
      leave.director_approval = "Approved";
  }

  // 6. Determine the final overall status of the leave request
  let finalStatus = "Pending";
  let allApproved = true;

  // Check if any approval is explicitly rejected
  if (
      leave.manager_approval === "Rejected" ||
      leave.hr_approval === "Rejected" ||
      leave.director_approval === "Rejected"
  ) {
      finalStatus = "Rejected";
  } else {
      // If no one rejected, check if everyone approved or if approval is not required
      if (leave.manager_approval !== "Approved" && leave.manager_approval !== "Not Required") {
          allApproved = false;
      }
      if (leave.hr_approval !== "Approved" && leave.hr_approval !== "Not Required") {
          allApproved = false;
      }
      if (leave.director_approval !== "Approved" && leave.director_approval !== "Not Required") {
          allApproved = false;
      }

      if (allApproved) {
          finalStatus = "Approved";
          // 7. Deduct leave balance upon final approval
          await db.query(
              `UPDATE leave_balances
               SET balance = balance - ?
               WHERE user_id = ? AND leave_type_id = ?`,
              [workingDays, leave.user_id, leave.leave_type_id]
          );
      }
  }

  // 8. Update the overall status and user_status in the leave_requests table
  await db.query(
      `UPDATE leave_requests
       SET status = ?, user_status = ?
       WHERE id = ?`,
      [
          finalStatus,
          finalStatus === "Approved" ? "Approved" : finalStatus === "Rejected" ? "Rejected" : "Pending",
          leaveId,
      ]
  );

  return finalStatus; // Return the final determined status
};
const cancelLeaveByUser = async (userId, leaveId) => {
  const [result] = await db.query(
    `
    UPDATE leave_requests 
    SET status = 'Rejected', user_status = 'Cancelled'
    WHERE id = ? AND user_id = ? AND status = 'Pending'
    `,
    [leaveId, userId]
  );
  return result;
};
const getLeaveRequestsByUserAndStatus = async (userId, status) => {
  const [rows] = await db.query(
    `SELECT lr.*, lt.name AS leave_type
     FROM leave_requests lr
     JOIN leave_types lt ON lr.leave_type_id = lt.id
     WHERE lr.user_id = ? AND lr.status = ?
     ORDER BY lr.created_at DESC`,
    [userId, status]
  );
  return rows;
};
const fetchPendingRequestsWithDetails = async (userId) => {
  const [rows] = await db.query(
    `SELECT 
        lr.*, 
        lt.name AS leave_type,
        emp.name AS employee_name,
        emp.email AS employee_email,
        mgr.name AS manager_name,
        hr.name AS hr_name,
        admin.name AS director_name,
        CASE 
          WHEN lr.manager_approval = 'Pending' THEN CONCAT(mgr.name, ' (', mgr.role, ')')
          WHEN lr.hr_approval = 'Pending' THEN CONCAT(hr.name, ' (', hr.role, ')')
          WHEN lr.director_approval = 'Pending' THEN CONCAT(admin.name, ' (', admin.role, ')')
          ELSE NULL
        END AS next_decision
     FROM leave_requests lr
     JOIN leave_types lt ON lr.leave_type_id = lt.id
     JOIN users emp ON lr.user_id = emp.id
     LEFT JOIN users mgr ON emp.manager_id = mgr.id
     LEFT JOIN users hr ON emp.hr_id = hr.id
     LEFT JOIN users admin ON emp.admin_id = admin.id
     WHERE lr.user_id = ? AND lr.status = 'Pending'`,
    [userId]
  );
  return rows;
};
const getLeaveStatusDetails = async (leaveRequestId) => {
  try {
      const [rows] = await db.query(
          `SELECT ls.*, u.name
           FROM leave_status ls
           JOIN users u ON ls.approver_id = u.id
           WHERE ls.leave_request_id = ?
           ORDER BY ls.approved_at ASC`,
          [leaveRequestId]
      );
      return rows;
  } catch (error) {
      console.error("Error fetching leave status details:", error);
      throw error;
  }
};
module.exports = {
  createLeaveRequest,
  getLeaveRequestsByUser,
  getLeaveRequestsBySubordinates,
  getLeaveRequestsForAdmin,
  updateLeaveApprovalByRole,
  cancelLeaveByUser,
  getLeaveRequestsByUserAndStatus,
  findPendingByUserId,
  fetchPendingRequestsWithDetails,
  getLeaveStatusDetails
};
