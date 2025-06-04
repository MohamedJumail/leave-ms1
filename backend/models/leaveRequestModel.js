const db = require("./db");

// Helper function to calculate working days between two dates,
// considering public holidays by querying the 'holidays' table.
const getWorkingDays = async (start_date, end_date) => {
  // Fetch holidays within the specified date range.
  const [holidays] = await db.query(
    `SELECT date FROM holidays WHERE date BETWEEN ? AND ?`,
    [start_date, end_date]
  );

  // Create a Set for quick lookup of holiday dates (formatted as 'YYYY-MM-DD').
  const holidaySet = new Set(
    holidays.map((h) => h.date.toISOString().split("T")[0])
  );

  const start = new Date(start_date);
  const end = new Date(end_date);
  let workingDays = 0;

  // Loop through each day from the start date to the end date (inclusive).
  for (
    let date = new Date(start);
    date <= end;
    date.setDate(date.getDate() + 1)
  ) {
    const day = date.getDay(); // Get the day of the week (0 for Sunday, 6 for Saturday).
    const formatted = date.toISOString().split("T")[0]; // Format date to 'YYYY-MM-DD'.

    // Check if the day is not a weekend (Sunday or Saturday) AND not a public holiday.
    if (day !== 0 && day !== 6 && !holidaySet.has(formatted)) {
      workingDays++; // Increment working days count.
    }
  }

  return workingDays;
};

// Function to find pending leave requests for a user based on their role.
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

  const [rows] = await db.query(query, params);
  return rows;
};

// Function to create initial leave status records for a new leave request.
const createLeaveStatusRecords = async (
  leaveRequestId,
  leaveTypeId,
  managerId,
  hrId,
  directorId
) => {
  const statusesToInsert = [];

  // Add Manager approval status if a manager is assigned.
  if (managerId !== null) {
    statusesToInsert.push({
      leave_request_id: leaveRequestId,
      leave_type_id: leaveTypeId,
      approver_id: managerId,
      approver_role: "Manager",
      approval_status: "Pending",
    });
  }

  // Add HR approval status if HR is assigned.
  if (hrId !== null) {
    statusesToInsert.push({
      leave_request_id: leaveRequestId,
      leave_type_id: leaveTypeId,
      approver_id: hrId,
      approver_role: "HR",
      approval_status: "Pending",
    });
  }

  // Add Director approval status if a director (admin) is assigned.
  if (directorId !== null) {
    statusesToInsert.push({
      leave_request_id: leaveRequestId,
      leave_type_id: leaveTypeId,
      approver_id: directorId,
      approver_role: "Director",
      approval_status: "Pending",
    });
  }

  // Insert all collected status records into the leave_status table.
  for (const status of statusesToInsert) {
    await db.query(
      `INSERT INTO leave_status (leave_request_id, leave_type_id, approver_id, approver_role, approval_status)
               VALUES (?, ?, ?, ?, ?)`,
      [
        status.leave_request_id,
        status.leave_type_id,
        status.approver_id,
        status.approver_role,
        status.approval_status,
      ]
    );
  }
};

// Function to create a new leave request.
const createLeaveRequest = async ({
  user_id,
  leave_type_id,
  start_date,
  end_date,
  reason,
}) => {
  // Step 1: Fetch user details to get their assigned manager, HR, and admin IDs.
  const [users] = await db.query(
    `SELECT manager_id, hr_id, admin_id FROM users WHERE id = ?`,
    [user_id]
  );

  if (users.length === 0) {
    throw new Error("User not found");
  }

  const { manager_id, hr_id, admin_id } = users[0];

  // Step 2: Insert the new leave request into the 'leave_requests' table.
  // Initial status for all approvals is 'Pending' or 'Not Required' based on assignment.
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

  // Step 3: Create initial leave status records for the newly created leave request.
  await createLeaveStatusRecords(
    leaveRequestId,
    leave_type_id,
    manager_id,
    hr_id,
    admin_id
  );

  return leaveRequestId;
};

// Function to fetch all leave requests submitted by a specific user.
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

// Function to fetch leave requests for subordinates based on the current user's role (Manager, HR).
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

// Function to fetch leave requests relevant to an Admin for approval.
const getLeaveRequestsForAdmin = async () => {
  try {
    console.log("Fetching leave requests for admin...");

    // Select pending requests where Director approval is still needed,
    // and Manager/HR have either approved or their approval was not required.
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

    return adminRelevantRequests;
  } catch (error) {
    console.error("Error fetching leave requests for admin:", error);
    throw error;
  }
};

// Function to update a specific entry in the 'leave_status' table.
// This function records individual approval decisions made by managers, HR, or directors.
const updateLeaveStatus = async ({
  leaveRequestId,
  approverRole,
  approvalStatus,
  approvalReason = null, // Default to null if no reason is provided
  approverId,
}) => {
  // Execute an SQL UPDATE query to modify the leave_status record.
  // It sets the approval status, reason, and records the timestamp of approval.
  // The WHERE clause ensures that the correct record for a specific leave request,
  // approver role, and approver ID is updated.
  await db.query(
    `UPDATE leave_status
       SET approval_status = ?, approval_reason = ?, approved_at = NOW()
       WHERE leave_request_id = ? AND approver_role = ? AND approver_id = ?`,
    [approvalStatus, approvalReason, leaveRequestId, approverRole, approverId]
  );
};

// Main function to handle the approval or rejection of a leave request by a specific role.
const updateLeaveApprovalByRole = async ({
  leaveId,
  role, // The role of the person making the decision (e.g., "Manager", "HR", "Admin")
  decision, // The decision made: 'Approved', 'Rejected', or 'Pending'
  reason, // The reason for the decision, especially important for rejections
  approverId, // The ID of the user who is making the approval/rejection
}) => {
  let column; // Stores the database column name corresponding to the approver's role
  let approverRoleForStatus; // Stores the role string used for the leave_status table

  // Determine the correct database column and approver role string based on the input 'role'.
  if (role === "Manager") {
    column = "manager_approval";
    approverRoleForStatus = "Manager";
  } else if (role === "HR") {
    column = "hr_approval";
    approverRoleForStatus = "HR";
  } else if (role === "Admin") {
    // Assuming 'Admin' role is responsible for 'Director' level approvals in this system.
    column = "director_approval";
    approverRoleForStatus = "Director";
  } else {
    // If an unauthorized role attempts to update, throw an error to prevent invalid operations.
    throw new Error("Unauthorized role attempting to update leave approval.");
  }

  // 1. Update the specific approval column in the 'leave_requests' table.
  // This records the direct action taken by the current approver (Manager, HR, or Director).
  await db.query(`UPDATE leave_requests SET ${column} = ? WHERE id = ?`, [
    decision,
    leaveId,
  ]);

  // 2. Record the specific approval action in the 'leave_status' table.
  // This provides a detailed audit trail of each individual approval decision.
  await updateLeaveStatus({
    leaveRequestId: leaveId,
    approverRole: approverRoleForStatus,
    approvalStatus: decision,
    approvalReason: reason,
    approverId, // The ID of the manager/HR/Admin who just acted
  });

  // 3. Re-fetch the updated leave request to get its current state from the database.
  // This is crucial for evaluating the overall approval status and applying cascading logic
  // based on the latest approval states of all roles.
  let [[leave]] = await db.query(
    `SELECT user_id, leave_type_id, start_date, end_date,
             manager_approval, hr_approval, director_approval
        FROM leave_requests WHERE id = ?`,
    [leaveId]
  );

  // If the leave request is not found (e.g., due to an invalid leaveId), throw an error.
  if (!leave) {
    throw new Error(`Leave request with ID ${leaveId} not found.`);
  }

  let finalStatus = "Pending"; // Initialize the overall final status of the leave request to 'Pending'.
  let directorAutoApproved = false; // Flag to track if director approval occurred automatically.

  // NEW LOGIC: If the current decision made by ANY approver is 'Rejected'.
  if (decision === "Rejected") {
    finalStatus = "Rejected"; // The overall leave status is immediately set to 'Rejected'.

    // Update ALL approval columns (manager, HR, director) in 'leave_requests' to 'Rejected'.
    // This ensures consistency across the board if one approver rejects the leave,
    // effectively stopping the approval process.
    await db.query(
      `UPDATE leave_requests SET manager_approval = 'Rejected', hr_approval = 'Rejected', director_approval = 'Rejected' WHERE id = ?`,
      [leaveId]
    );

    // Re-fetch the 'leave' object again to ensure it reflects the newly cascaded rejections.
    // This updated 'leave' object will be used for subsequent checks and 'leave_status' updates.
    [[leave]] = await db.query(
      `SELECT user_id, leave_type_id, start_date, end_date,
              manager_approval, hr_approval, director_approval
           FROM leave_requests WHERE id = ?`,
      [leaveId]
    );

    // Also update the 'leave_status' table for other roles that might not have explicitly rejected.
    // This provides a complete audit trail of the overall rejection for all relevant approvers.
    const rejectionReason = `Cascaded rejection from ${role} (${reason}).`;

    // Add a 'Rejected' status entry for Manager if their approval was not the one that just rejected
    // and if their approval status is not already 'Rejected'.
    if (approverRoleForStatus !== "Manager" && leave.manager_approval !== "Rejected" && leave.manager_approval !== "Not Required") {
      await updateLeaveStatus({
        leaveRequestId: leaveId,
        approverRole: "Manager",
        approvalStatus: "Rejected",
        approvalReason: rejectionReason,
        approverId: approverId, // Use the ID of the person who initiated the rejection for consistency
      });
    }
    // Add a 'Rejected' status entry for HR if their approval was not the one that just rejected
    // and if their approval status is not already 'Rejected'.
    if (approverRoleForStatus !== "HR" && leave.hr_approval !== "Rejected" && leave.hr_approval !== "Not Required") {
      await updateLeaveStatus({
        leaveRequestId: leaveId,
        approverRole: "HR",
        approvalStatus: "Rejected",
        approvalReason: rejectionReason,
        approverId: approverId,
      });
    }
    // Add a 'Rejected' status entry for Director if their approval was not the one that just rejected
    // and if their approval status is not already 'Rejected'.
    if (approverRoleForStatus !== "Director" && leave.director_approval !== "Rejected" && leave.director_approval !== "Not Required") {
      await updateLeaveStatus({
        leaveRequestId: leaveId,
        approverRole: "Director",
        approvalStatus: "Rejected",
        approvalReason: rejectionReason,
        approverId: approverId,
      });
    }
  } else {
    // This block executes ONLY if the current decision is NOT 'Rejected' (i.e., 'Approved' or 'Pending').

    // 4. Calculate the number of working days for the leave duration.
    // This is used for the auto-approval logic.
    const workingDays = await getWorkingDays(leave.start_date, leave.end_date);

    // 5. Get the role of the user who *applied* for the leave (the applicant).
    // This information is necessary for the director auto-approval condition.
    const [[applicantUser]] = await db.query(
      `SELECT role, manager_id, hr_id, admin_id FROM users WHERE id = ?`,
      [leave.user_id]
    );

    // ✨ Auto-approve director for leaves of 3 working days or less.
    // This auto-approval applies ONLY for Manager and Employee applicants.
    // It will NOT run if the director approval is already 'Approved' or 'Rejected',
    // and crucially, it will NOT run if the leave was already rejected by a Manager or HR
    // in the current flow (handled by the outer 'if (decision === "Rejected")' block).
    if (
      leave.director_approval === "Pending" && // Ensure Director approval is still pending
      workingDays <= 3 &&
      (applicantUser.role === "Manager" || applicantUser.role === "Employee")
    ) {
      // Update 'director_approval' in 'leave_requests' to 'Approved' due to auto-approval.
      await db.query(
        `UPDATE leave_requests SET director_approval = 'Approved' WHERE id = ?`,
        [leaveId]
      );

      // Record this auto-approval in the 'leave_status' table.
      await updateLeaveStatus({
        leaveRequestId: leaveId,
        approverRole: "Director",
        approvalStatus: "Approved",
        approvalReason: "Auto-approved due to short leave duration.",
        approverId: applicantUser.admin_id, // Use the applicant's admin_id as the approver for auto-approval
      });

      // Set the flag to indicate that the director's approval occurred automatically.
      directorAutoApproved = true;
    }

    // 6. Determine the final overall status of the leave request.
    // Re-fetch the 'leave' object one more time to ensure we have the very latest state,
    // especially if auto-approval just occurred, as the 'leave' object in memory might be outdated.
    [[leave]] = await db.query(
      `SELECT user_id, leave_type_id, start_date, end_date,
              manager_approval, hr_approval, director_approval
           FROM leave_requests WHERE id = ?`,
      [leaveId]
    );

    let allApproved = true; // Assume all required approvals are in initially.

    // Check if any approval is explicitly rejected. This covers any rejections that might have happened
    // before or during this process.
    if (
      leave.manager_approval === "Rejected" ||
      leave.hr_approval === "Rejected" ||
      leave.director_approval === "Rejected"
    ) {
      finalStatus = "Rejected"; // If any rejection is found, the overall status is 'Rejected'.
    } else {
      // If no one has rejected, check if everyone required has approved or if their approval is 'Not Required'.
      if (
        leave.manager_approval !== "Approved" &&
        leave.manager_approval !== "Not Required"
      ) {
        allApproved = false; // Manager approval is still pending or not approved.
      }
      if (
        leave.hr_approval !== "Approved" &&
        leave.hr_approval !== "Not Required"
      ) {
        allApproved = false; // HR approval is still pending or not approved.
      }
      if (
        leave.director_approval !== "Approved" &&
        leave.director_approval !== "Not Required"
      ) {
        allApproved = false; // Director approval is still pending or not approved.
      }

      if (allApproved) {
        finalStatus = "Approved"; // All required approvals are in, and no rejections have occurred.
      }
    }
  }

  // 7. Deduct leave balance ONLY if the final overall status is 'Approved'.
  if (finalStatus === "Approved") {
    // Re-calculate working days to ensure accuracy for leave balance deduction,
    // in case 'leave' object was updated or for general robustness.
    const workingDays = await getWorkingDays(leave.start_date, leave.end_date);
    await db.query(
      `UPDATE leave_balances
             SET balance = balance - ?
             WHERE user_id = ? AND leave_type_id = ?`,
      [workingDays, leave.user_id, leave.leave_type_id]
    );
  }

  // 8. Update the overall 'status' and 'user_status' columns in the 'leave_requests' table.
  // 'status' reflects the internal processing status, while 'user_status' provides a simplified
  // status for the end-user's view (Approved, Rejected, or Pending).
  await db.query(
    `UPDATE leave_requests
       SET status = ?, user_status = ?
       WHERE id = ?`,
    [
      finalStatus,
      // Map the internal finalStatus to the user-facing user_status.
      finalStatus === "Approved"
        ? "Approved"
        : finalStatus === "Rejected"
        ? "Rejected"
        : "Pending", // If not Approved or Rejected, it's Pending for the user.
      leaveId,
    ]
  );

  // Return the final determined status of the leave request.
  return { success: true, finalStatus };
};

// Function to fetch leave requests by user and status.
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

// Function to fetch pending leave requests with detailed information about employee and approvers.
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

// Function to fetch detailed status information for a specific leave request.
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

// Function to allow a user to cancel their own pending leave request.
const cancelLeaveByUser = async (leaveId, userId) => {
  try {
    console.log(`Attempting to cancel leaveId: ${leaveId} for userId: ${userId}`);

    // 1. Fetch Leave Details
    const [[leaveRequest]] = await db.query(
      `SELECT id, user_id, status, start_date, end_date, leave_type_id
       FROM leave_requests WHERE id = ? AND user_id = ?`,
      [leaveId, userId]
    );

    console.log("Query result for leaveRequest:", leaveRequest);

    if (!leaveRequest) {
      throw new Error("Leave request not found or you are not authorized to cancel it.");
    }

    // Only allow cancellation of pending or approved requests for reimbursement logic
    // If it's already rejected or cancelled, no action needed for status or reimbursement.
    if (leaveRequest.status === "Rejected" || leaveRequest.status === "Cancelled") {
      throw new Error("This leave request is already " + leaveRequest.status.toLowerCase() + " and cannot be cancelled further.");
    }

    let reimburseDays = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date to start of day for accurate comparison

    const leaveStartDate = new Date(leaveRequest.start_date);
    leaveStartDate.setHours(0, 0, 0, 0);

    const leaveEndDate = new Date(leaveRequest.end_date);
    leaveEndDate.setHours(0, 0, 0, 0);

    console.log(`Today: ${today.toISOString().split('T')[0]}, Leave Start: ${leaveStartDate.toISOString().split('T')[0]}, Leave End: ${leaveEndDate.toISOString().split('T')[0]}`);
    console.log(`Leave status before reimbursement check: ${leaveRequest.status}`);

    // Determine reimbursement logic based on cancellation date
    if (today < leaveStartDate) {
      // Cancellation before leave starts: reimburse full duration if it was approved
      if (leaveRequest.status === "Approved") {
          reimburseDays = await getWorkingDays(leaveRequest.start_date, leaveRequest.end_date);
          console.log(`Cancelling before start date. Reimbursing full ${reimburseDays} days.`);
      } else {
          console.log("Leave not yet approved, no balance deduction to reimburse (status is not 'Approved').");
          // If leave was pending, no deduction happened, so no reimbursement needed.
      }
    } else if (today >= leaveStartDate && today <= leaveEndDate) {
      // Cancellation during leave: reimburse remaining days
      if (leaveRequest.status === "Approved") {
          reimburseDays = await getWorkingDays(today.toISOString().split('T')[0], leaveRequest.end_date);
          console.log(`Cancelling during leave. Reimbursing remaining ${reimburseDays} days.`);

          // *** NEW LOGIC: Update end_date in leave_requests table ***
          await db.query(
            `UPDATE leave_requests
             SET end_date = ?
             WHERE id = ?`,
            [today.toISOString().split('T')[0], leaveId] // Set end_date to today
          );
          console.log(`Leave request ${leaveId} end_date updated to ${today.toISOString().split('T')[0]} due to mid-leave cancellation.`);
      } else {
           console.log("Leave not yet approved, no balance deduction to reimburse (status is not 'Approved').");
      }
    } else {
      // Cancellation after leave ends: no reimbursement
      console.log("Cancellation after leave end date. No reimbursement.");
      reimburseDays = 0;
    }

    // 2. Update Leave Balances (only if there are days to reimburse)
    if (reimburseDays > 0) {
      await db.query(
        `UPDATE leave_balances
         SET balance = balance + ?
         WHERE user_id = ? AND leave_type_id = ?`,
        [reimburseDays, leaveRequest.user_id, leaveRequest.leave_type_id]
      );
      console.log(`Reimbursed ${reimburseDays} days to user ${leaveRequest.user_id} for leave type ${leaveRequest.leave_type_id}.`);
    }

    // 3. Update the main leave_requests table to 'Cancelled'.
    await db.query(
      `UPDATE leave_requests
       SET status = 'Cancelled', user_status = 'Cancelled'
       WHERE id = ?`,
      [leaveId]
    );
    console.log(`Leave request ${leaveId} status updated to 'Cancelled' in leave_requests table.`);

    // 4. Update all related entries in the leave_status table to 'Cancelled'.
    await db.query(
      `UPDATE leave_status
       SET approval_status = 'Cancelled', approval_reason = 'Cancelled by user', approved_at = NOW()
       WHERE leave_request_id = ? AND (approval_status = 'Pending' OR approval_status = 'Approved')`, // Only update pending or approved statuses
      [leaveId]
    );
    console.log(`Leave status entries for request ${leaveId} updated to 'Cancelled'.`);

    return { success: true, message: "Leave request cancelled successfully." };
  } catch (error) {
    console.error("Error cancelling leave request:", error);
    throw error;
  }
};


// Export all functions for use in other modules.
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
  getLeaveStatusDetails,
};
