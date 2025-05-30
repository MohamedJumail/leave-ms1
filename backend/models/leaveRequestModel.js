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
// Approve or Reject a leave request by Manager/HR
const updateLeaveApprovalByRole = async ({ leaveId, role, decision }) => {
  let column;

  if (role === "Manager") {
    column = "manager_approval";
  } else if (role === "HR") {
    column = "hr_approval";
  } else if (role === "Admin") { // Assuming 'Admin' role is responsible for director_approval
    column = "director_approval";
  }

  // 1. Update the relevant approval column if the role is valid
  if (column) {
    await db.query(`UPDATE leave_requests SET ${column} = ? WHERE id = ?`, [
      decision,
      leaveId,
    ]);
  }

  // 2. Refetch the updated leave request to check all approval statuses
  let [[leave]] = await db.query( // Use 'let' here as 'leave' might be updated
    `SELECT user_id, leave_type_id, start_date, end_date,
            manager_approval, hr_approval, director_approval
     FROM leave_requests WHERE id = ?`,
    [leaveId]
  );

  const workingDays = await getWorkingDays(leave.start_date, leave.end_date);
  const [[user]] = await db.query(`SELECT role FROM users WHERE id = ?`, [
    leave.user_id,
  ]);  // ✨ Auto-approve director for <= 3 working days, ONLY for Manager and Employee roles
  if (
    workingDays <= 3 &&
    leave.director_approval === "Pending" &&
    (user.role === "Manager" || user.role === "Employee") // New condition for applicant role
  ) {
    await db.query(
      `UPDATE leave_requests SET director_approval = 'Approved' WHERE id = ?`,
      [leaveId]
    );
    // Update the 'leave' object in memory to reflect the change
    leave.director_approval = "Approved";
  }
  // 5. Determine the final status based on all current approval states
  let finalStatus = "Pending";
  let allApproved = true;

  // Check Manager Approval
  if (leave.manager_approval !== "Approved" && leave.manager_approval !== "Not Required") {
    allApproved = false;
  }

  // Check HR Approval
  if (leave.hr_approval !== "Approved" && leave.hr_approval !== "Not Required") {
    allApproved = false;
  }

  // Check Director Approval
  if (leave.director_approval !== "Approved" && leave.director_approval !== "Not Required") {
    allApproved = false;
  }

  if (allApproved) {
    finalStatus = "Approved";

    // 6. Deduct leave balance upon final approval
    // You might want a flag in the DB to prevent double deduction, or ensure this function is idempotent.
    // For simplicity, we'll assume it's safe to deduct here once finalStatus is Approved.
    await db.query(
      `UPDATE leave_balances
        SET balance = balance - ?
        WHERE user_id = ? AND leave_type_id = ?`,
      [workingDays, leave.user_id, leave.leave_type_id]
    );
  } else if (
    leave.manager_approval === "Rejected" ||
    leave.hr_approval === "Rejected" ||
    leave.director_approval === "Rejected"
  ) {
    finalStatus = "Rejected";
  }

  // 7. Update the overall status and user status in the database
  await db.query(
    `UPDATE leave_requests
      SET status = ?, user_status = ?
      WHERE id = ?`,
    [
      finalStatus,
      finalStatus === "Approved"
        ? "Approved"
        : finalStatus === "Rejected"
        ? "Rejected"
        : "Pending",
      leaveId,
    ]
  );

  return finalStatus;
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
};
