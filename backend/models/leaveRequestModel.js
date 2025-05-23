const db = require("./db");

const findPendingByUserId = async (userId, role) => {
  let query = '';
  let params = [userId];

  if (role === 'Manager') {
    query = `
      SELECT * FROM leave_requests
      WHERE user_id = ? AND status = 'Pending' AND manager_approval = 'Pending'
    `;
  } else if (role === 'HR') {
    query = `
      SELECT * FROM leave_requests
      WHERE user_id = ? AND status = 'Pending' AND manager_approval = 'Approved' AND hr_approval = 'Pending'
    `;
  }

  const [rows] = await db.execute(query, params);
  return rows;
};
// Create a leave request
const createLeaveRequest = async ({
  user_id,
  leave_type_id,
  start_date,
  end_date,
  reason,
}) => {
  const [result] = await db.query(
    `INSERT INTO leave_requests 
     (user_id, leave_type_id, start_date, end_date, reason, status, manager_approval, hr_approval, director_approval,user_status) 
     VALUES (?, ?, ?, ?, ?, 'Pending', 'Pending', 'Pending', 'Pending', 'Pending')`, // added 'director_approval' as 'Pending'
    [user_id, leave_type_id, start_date, end_date, reason]
  );
  return result.insertId;
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
    query += ` AND lr.manager_approval = 'Approved' AND lr.hr_approval = 'Pending' AND u.hr_id = ?`;
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

    // Step 1: Fetch all pending requests approved by Manager & HR
    const [adminRelevantRequests] = await db.query(`
      SELECT lr.*, lt.name AS leave_type, u.name AS employee_name,
             lr.director_approval, lr.hr_approval, lr.manager_approval,
             DATEDIFF(lr.end_date, lr.start_date) AS total_days
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN users u ON lr.user_id = u.id
      WHERE 
        lr.status = 'Pending' 
        AND lr.hr_approval = 'Approved'
        AND lr.manager_approval = 'Approved'
        AND lr.user_status = "Pending"
    `);

    // Step 2: Filter admin-relevant requests by working days > 5
    const filteredAdminRequests = [];
    for (let request of adminRelevantRequests) {
      const workingDays = await getWorkingDays(
        request.start_date,
        request.end_date
      );

      if (workingDays > 5) {
        filteredAdminRequests.push({ ...request, workingDays });
      }
    }

    // Step 3: Fetch pending leave requests submitted by HR users
    const [hrPendingRequests] = await db.query(`
      SELECT lr.*, lt.name AS leave_type, u.name AS employee_name,
             lr.director_approval, lr.hr_approval, lr.manager_approval,
             DATEDIFF(lr.end_date, lr.start_date) AS total_days
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      JOIN users u ON lr.user_id = u.id
      WHERE 
        lr.status = 'Pending' AND
        lr.user_status = 'Pending'
        AND u.role = 'HR'
    `);

    // You can optionally add workingDays to HR requests too
    const finalHRRequests = [];
    for (let request of hrPendingRequests) {
      const workingDays = await getWorkingDays(
        request.start_date,
        request.end_date
      );
      finalHRRequests.push({ ...request, workingDays });
    }

    // Combine both
    const allRequests = [...filteredAdminRequests, ...finalHRRequests];

    console.log("Final combined leave requests for admin:", allRequests);
    return allRequests;
  } catch (error) {
    console.error("Error fetching leave requests for admin:", error);
    throw error;
  }
};


// Approve or Reject a leave request by Manager/HR
const updateLeaveApprovalByRole = async ({ leaveId, role, decision }) => {
  let column;
  let finalStatus = "Pending";

  if (role === "Manager") {
    column = "manager_approval";
  } else if (role === "HR") {
    column = "hr_approval";
  } else if (role === "Admin") {
    column = "director_approval";
  }

  // 1. Update the relevant approval column
  await db.query(`UPDATE leave_requests SET ${column} = ? WHERE id = ?`, [
    decision,
    leaveId,
  ]);

  // 2. Refetch the updated leave request
  const [[leave]] = await db.query(
    `SELECT user_id, leave_type_id, start_date, end_date, 
            manager_approval, hr_approval, director_approval
     FROM leave_requests WHERE id = ?`,
    [leaveId]
  );

  // 3. Calculate working days
  const workingDays = await getWorkingDays(leave.start_date, leave.end_date);

  // Auto-approve director for <= 3 working days
  if (workingDays <= 3 && leave.director_approval !== "Approved") {
    await db.query(
      `UPDATE leave_requests SET director_approval = 'Approved' WHERE id = ?`,
      [leaveId]
    );
    leave.director_approval = "Approved";
  }

  // 🔍 4. Check if the leave applicant is HR
  const [[user]] = await db.query(`SELECT role FROM users WHERE id = ?`, [
    leave.user_id,
  ]);

  // 🟡 5. If user is HR and director has approved → approve all automatically
  if (user.role === "HR" && leave.director_approval === "Approved") {
    await db.query(
      `UPDATE leave_requests 
       SET manager_approval = 'Approved', 
           hr_approval = 'Approved', 
           status = 'Approved',
           user_status = 'Approved' 
       WHERE id = ?`,
      [leaveId]
    );

    // Deduct leave balance
    await db.query(
      `UPDATE leave_balances 
       SET balance = balance - ? 
       WHERE user_id = ? AND leave_type_id = ?`,
      [workingDays, leave.user_id, leave.leave_type_id]
    );

    return "Approved";
  }

  // 6. Normal approval flow
  if (
    leave.manager_approval === "Rejected" ||
    leave.hr_approval === "Rejected" ||
    leave.director_approval === "Rejected"
  ) {
    finalStatus = "Rejected";
  } else if (
    leave.manager_approval === "Approved" &&
    leave.hr_approval === "Approved" &&
    leave.director_approval === "Approved"
  ) {
    finalStatus = "Approved";

    await db.query(
      `UPDATE leave_balances 
       SET balance = balance - ? 
       WHERE user_id = ? AND leave_type_id = ?`,
      [workingDays, leave.user_id, leave.leave_type_id]
    );
  }

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
  fetchPendingRequestsWithDetails
};
