const {
  createLeaveRequest,
  getLeaveRequestsByUser,
  getLeaveRequestsBySubordinates,
  updateLeaveApprovalByRole,
} = require("../models/leaveRequestModel");

const { getAllLeaveTypes } = require("../models/leaveTypeModel");
const { getUserLeaveBalances } = require("../models/leaveBalanceModel");
const { getLeaveRequestsForAdmin } = require("../models/leaveRequestModel");
const { cancelLeaveByUser } = require("../models/leaveRequestModel");
const {
  getLeaveRequestsByUserAndStatus,
  findPendingByUserId
} = require("../models/leaveRequestModel");
const leaveRequestModel = require('../models/leaveRequestModel');
const db = require("../models/db");
const getPendingRequestsByUserId = async (request, h) => {
  try {
    const userId = request.params.userId;
    const requester = request.pre.auth; // <-- fixed here

    console.log("Auth user:", requester);
    console.log("Requested userId:", userId);

    if (!userId || isNaN(userId)) {
      return h.response({ error: 'Invalid userId' }).code(400);
    }

    if (!requester || !requester.role) {
      return h.response({ error: 'Unauthorized' }).code(401);
    }

    const requesterRole = requester.role;

    let pendingRequests = [];

    if (requesterRole === 'Manager') {
      pendingRequests = await findPendingByUserId(userId, 'Manager');
    } else if (requesterRole === 'HR') {
      pendingRequests = await findPendingByUserId(userId, 'HR');
    } else {
      return h.response({ error: 'Access Denied' }).code(403);
    }

    return h.response(pendingRequests).code(200);
  } catch (error) {
    console.error('Error fetching pending leave requests:', error);
    return h.response({ error: 'Internal Server Error', message: error.message }).code(500);
  }
};

// Utility to get working weekdays excluding weekends & holidays
const getWorkingDays = (start, end, holidays = []) => {
  const workingDays = [];
  let current = new Date(start);

  while (current <= end) {
    const day = current.getDay();
    const dateStr = current.toISOString().split("T")[0];

    if (day !== 0 && day !== 6 && !holidays.includes(dateStr)) {
      workingDays.push(dateStr);
    }

    current.setDate(current.getDate() + 1);
  }

  return workingDays;
};

const applyLeave = async (request, h) => {
  try {
    console.log("applyLeave - Request received:", request.payload);
    const user_id = request.pre.auth.id;
    const { leave_type_id, start_date, end_date, reason } = request.payload;

    console.log("applyLeave - User ID:", user_id);
    console.log("applyLeave - Leave Type ID:", leave_type_id);
    console.log("applyLeave - Start Date:", start_date);
    console.log("applyLeave - End Date:", end_date);
    console.log("applyLeave - Reason:", reason);

    const today = new Date();
    const start = new Date(start_date);
    const end = new Date(end_date);

    console.log("applyLeave - Today's Date:", today);
    console.log("applyLeave - Parsed Start Date:", start);
    console.log("applyLeave - Parsed End Date:", end);

    // Validation 2: Start date must be before or equal to end date
    if (start > end) {
      console.log("applyLeave - Validation Failed: Start date after end date");
      return h
        .response({ msg: "Start date cannot be after end date" })
        .code(400);
    }

    // 1. Validate leave type
    console.log("applyLeave - Fetching all leave types");
    const leaveTypes = await getAllLeaveTypes();
    console.log("applyLeave - Fetched leave types:", leaveTypes);
    const selectedType = leaveTypes.find((lt) => lt.id === leave_type_id);
    console.log("applyLeave - Selected leave type:", selectedType);
    if (!selectedType) {
      console.log("applyLeave - Validation Failed: Invalid leave type");
      return h.response({ msg: "Invalid leave type" }).code(400);
    }

    // 2. Check apply-before-days rule
    const daysBefore = (start - today) / (1000 * 60 * 60 * 24);
    console.log("applyLeave - Days before start date:", daysBefore);
    console.log("applyLeave - Apply before days required:", selectedType.apply_before_days);
    if (daysBefore < selectedType.apply_before_days) {
      console.log("applyLeave - Validation Failed: Apply before days not met");
      return h
        .response({
          msg: `You must apply at least ${selectedType.apply_before_days} days in advance`,
        })
        .code(400);
    }

    // 3. Get user's leave balance
    console.log("applyLeave - Fetching user leave balances for user ID:", user_id);
    const balances = await getUserLeaveBalances(user_id);
    console.log("applyLeave - User leave balances:", balances);
    const balanceEntry = balances.find(
      (b) =>
        b.leave_type.trim().toLowerCase() ===
        selectedType.name.trim().toLowerCase()
    );
    console.log("applyLeave - Found balance entry:", balanceEntry);
    if (!balanceEntry) {
      console.log("applyLeave - Validation Failed: No leave balance for this type");
      return h
        .response({
          msg: "No leave balance for this type",
          debug: {
            selectedType: selectedType.name,
            userId: user_id,
            availableTypes: balances.map((b) => b.leave_type),
          },
        })
        .code(400);
    }

    // 4. Get holidays
    console.log("applyLeave - Fetching holidays");
    const [holidayRows] = await db.query(`SELECT date FROM holidays`);
    const holidays = holidayRows.map((h) => h.date.toISOString().split("T")[0]);
    console.log("applyLeave - Fetched holidays:", holidays);

    // 5. Calculate working days
    console.log("applyLeave - Calculating working days between:", start, "and", end, "excluding:", holidays);
    const workingDays = getWorkingDays(start, end, holidays);
    console.log("applyLeave - Calculated working days:", workingDays);
    if (workingDays.length === 0) {
      console.log("applyLeave - Validation Failed: No working days selected");
      return h.response({ msg: "No working days selected" }).code(400);
    }

    if (start < today) {
      console.log("applyLeave - Validation Failed: Cannot apply for past dates");
      return h.response({ msg: "Cannot apply for past dates" }).code(400);
    }
    // 6. Check balance
    console.log("applyLeave - Working days required:", workingDays.length);
    console.log("applyLeave - Available balance:", balanceEntry.balance);
    if (workingDays.length > balanceEntry.balance) {
      console.log("applyLeave - Validation Failed: Insufficient leave balance");
      return h
        .response({
          msg: `Insufficient leave balance. You need ${workingDays.length}, but have ${balanceEntry.balance}`,
        })
        .code(400);
    }

    // 6.5 Check for overlapping leave requests
    console.log("applyLeave - Checking for overlapping leave requests");
    const [overlapping] = await db.query(
      `
      SELECT * FROM leave_requests
      WHERE user_id = ?
        AND (
          (start_date <= ? AND end_date >= ?)
          OR
          (start_date <= ? AND end_date >= ?)
          OR
          (start_date >= ? AND end_date <= ?)
        )
        AND status IN ('Pending', 'Approved')
    `,
      [
        user_id,
        end_date,
        end_date,
        start_date,
        start_date,
        start_date,
        end_date,
      ]
    );

    if (overlapping.length > 0) {
      console.log("applyLeave - Validation Failed: Overlapping leave request found");
      return h
        .response({
          msg: "You already have a leave request that overlaps with these dates",
        })
        .code(400);
    }

    // 7. Insert into leave_requests with director_approval set to 'Pending'
    console.log("applyLeave - Creating leave request");
    const leaveId = await createLeaveRequest({
      user_id,
      leave_type_id,
      start_date,
      end_date,
      reason,
    });
    console.log("applyLeave - Leave request created with ID:", leaveId);

    return h
      .response({
        msg: `Leave request submitted for ${workingDays.length} working day(s).`,
        leaveId,
      })
      .code(201);
  } catch (error) {
    console.error("Error in applyLeave:", error); // 👈 log full error
    return h
      .response({ msg: "Something went wrong", error: error.message })
      .code(500);
  }
};
const getMyLeaveRequests = async (request, h) => {
  const userId = request.pre.auth.id; // 👈 changed from
  const leaves = await getLeaveRequestsByUser(userId);
  return h.response(leaves).code(200);
};
const getSubordinateLeaveRequests = async (request, h) => {
  try {
    const { id: userId, role } = request.pre.auth;

    const leaves = await getLeaveRequestsBySubordinates(userId, role);
    return h.response(leaves).code(200);
  } catch (error) {
    console.error("Error fetching subordinate leave requests:", error);
    return h
      .response({ msg: "Something went wrong", error: error.message })
      .code(500);
  }
};
const getAdminLeaveRequests = async (request, h) => {
  try {
    const leaves = await getLeaveRequestsForAdmin();
    return h.response(leaves).code(200);
  } catch (error) {
    console.error("Error fetching admin leave requests:", error);
    return h
      .response({ msg: "Something went wrong", error: error.message })
      .code(500);
  }
}; 
const approveOrRejectLeaveRequest = async (request, h) => {
  const { id: approverId, role } = request.pre.auth;
  const { leaveId } = request.params;
  const { decision, reason } = request.payload; // Reason can be null for approval

  if (!["Approved", "Rejected"].includes(decision)) {
      return h.response({ msg: "Invalid decision" }).code(400);
  }

  if (!["Manager", "HR", "Admin"].includes(role)) {
      return h.response({ msg: "Unauthorized role" }).code(403);
  }

  try {
      const status = await updateLeaveApprovalByRole({
          leaveId: parseInt(leaveId),
          role,
          decision,
          reason, // Pass the reason to the model
          approverId,
      });
      return h.response({ msg: `Leave request ${status} by ${role}.` });
  } catch (err) {
      console.error("Approval/Rejection error:", err);
      return h
          .response({ msg: "Failed to update leave", error: err.message })
          .code(500);
  }
};
const cancelLeaveRequest = async (request, h) => {
  const userId = request.pre.auth.id;
  const { leaveId } = request.params;

  try {
    const result = await cancelLeaveByUser(userId, leaveId);

    if (result.affectedRows === 0) {
      return h
        .response({ msg: "Leave not found or cannot be cancelled" })
        .code(404);
    }

    return h
      .response({ msg: "Leave request cancelled successfully" })
      .code(200);
  } catch (err) {
    console.error("Error cancelling leave:", err);
    return h
      .response({ msg: "Failed to cancel leave", error: err.message })
      .code(500);
  }
};

const getLeaveRequestsByStatus = async (request, h) => {
  const userId = request.pre.auth.id;
  const status = request.params.status;

  const validStatuses = ["Pending", "Approved", "Rejected"];

  if (!validStatuses.includes(status)) {
    return h
      .response({
        msg: "Invalid status. Must be one of: Pending, Approved, Rejected",
      })
      .code(400);
  }

  try {
    const leaves = await getLeaveRequestsByUserAndStatus(userId, status);
    return h.response(leaves).code(200);
  } catch (error) {
    console.error("Error fetching by status:", error);
    return h
      .response({ msg: "Something went wrong", error: error.message })
      .code(500);
  }
};
const getAdminPendingRequestsForUser = async (req, h) => {
  const { userId } = req.params;

  try {
    const pendingRequests = await leaveRequestModel.fetchPendingRequestsWithDetails(userId);
    console.log(pendingRequests);
    return h.response(pendingRequests).code(200);
  } catch (error) {
    console.error("Error in getAdminPendingRequestsForUser:", error);
    return h.response({ error: "Failed to fetch leave requests." }).code(500);
  }
};
const getLeaveStatus = async (req, h) => {
  const { leaveId } = req.params;

  if (!leaveId) {
    return h.response({ msg: 'Leave ID is required' }).code(400);
  }

  try {
    const statusDetails = await leaveRequestModel.getLeaveStatusDetails(leaveId);
    return h.response(statusDetails).code(200);
  } catch (error) {
    console.error("Error in getLeaveStatus controller:", error);
    return h.response({ msg: 'Failed to fetch leave status details' }).code(500);
  }
};
module.exports = {
  applyLeave,
  getMyLeaveRequests,
  getSubordinateLeaveRequests,
  getAdminLeaveRequests,
  cancelLeaveRequest,
  approveOrRejectLeaveRequest,
  getLeaveRequestsByStatus,
  getPendingRequestsByUserId,
  getAdminPendingRequestsForUser,
  getLeaveStatus,
};
