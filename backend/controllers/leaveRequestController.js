const {
  createLeaveRequest,
  getLeaveRequestsByUser,
  getLeaveRequestsBySubordinates,
  updateLeaveApprovalByRole,
  getLeaveRequestsForAdmin,
  cancelLeaveByUser,
  getLeaveRequestsByUserAndStatus,
  findPendingByUserId,
  fetchPendingRequestsWithDetails,
  getLeaveStatusDetails,
  calculateActualLeaveDuration,
} = require("../models/leaveRequestModel");

const { getAllLeaveTypes } = require("../models/leaveTypeModel");
const { getUserLeaveBalances } = require("../models/leaveBalanceModel");
const db = require("../models/db");

const FULL_DAY = 1;
const FIRST_HALF = 2;
const SECOND_HALF = 3;

const getPendingRequestsByUserId = async (request, h) => {
  try {
      const userId = request.params.userId;
      const requester = request.pre.auth;

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

const applyLeave = async (request, h) => {
  try {
      const user_id = request.pre.auth.id;
      const {
          leave_type_id,
          start_date,
          end_date,
          reason,
          start_half_day_type = FULL_DAY,
          end_half_day_type = FULL_DAY
      } = request.payload;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(start_date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(end_date);
      end.setHours(0, 0, 0, 0);

      if (start > end) {
          return h.response({ msg: "Start date cannot be after end date" }).code(400);
      }
      if (start < today) {
          return h.response({ msg: "Cannot apply for past dates" }).code(400);
      }

      const validHalfDayTypes = [FULL_DAY, FIRST_HALF, SECOND_HALF];
      if (!validHalfDayTypes.includes(start_half_day_type) || !validHalfDayTypes.includes(end_half_day_type)) {
          return h.response({ msg: "Invalid half-day type provided. Use 1 (Full Day), 2 (First Half), or 3 (Second Half)." }).code(400);
      }

      if (start.getTime() === end.getTime()) {
          if (start_half_day_type === SECOND_HALF && end_half_day_type === FIRST_HALF) {
              return h.response({ msg: "For a single-day leave, 'End Half-Day' cannot be 'First Half' if 'Start Half-Day' is 'Second Half' (logically impossible)." }).code(400);
          }
          if ((start_half_day_type === FULL_DAY && end_half_day_type !== FULL_DAY) ||
              (start_half_day_type !== FULL_DAY && end_half_day_type === FULL_DAY)) {
              return h.response({ msg: "For a single-day leave, if 'Full Day' is selected, both start and end half-day types must be 'Full Day'." }).code(400);
          }
      }

      const leaveTypes = await getAllLeaveTypes();
      const selectedType = leaveTypes.find((lt) => lt.id === leave_type_id);
      if (!selectedType) {
          return h.response({ msg: "Invalid leave type" }).code(400);
      }

      const daysBefore = (start - today) / (1000 * 60 * 60 * 24);
      if (daysBefore < selectedType.apply_before_days) {
          return h.response({
              msg: `You must apply at least ${selectedType.apply_before_days} days in advance`,
          }).code(400);
      }

      const balances = await getUserLeaveBalances(user_id);
      const balanceEntry = balances.find(
          (b) => b.leave_type.trim().toLowerCase() === selectedType.name.trim().toLowerCase()
      );
      if (!balanceEntry) {
          return h.response({
              msg: "No leave balance for this type",
              debug: {
                  selectedType: selectedType.name,
                  userId: user_id,
                  availableTypes: balances.map((b) => b.leave_type),
              },
          }).code(400);
      }

      const calculatedLeaveDuration = await calculateActualLeaveDuration(
          start_date,
          end_date,
          start_half_day_type,
          end_half_day_type
      );

      if (calculatedLeaveDuration <= 0) {
          return h.response({ msg: "The selected leave period results in zero or negative working days/hours. Please check dates and half-day selections." }).code(400);
      }

      if (calculatedLeaveDuration > balanceEntry.balance) {
          return h.response({
              msg: `Insufficient leave balance. You need ${calculatedLeaveDuration} days, but have ${balanceEntry.balance} days available for ${selectedType.name}.`,
          }).code(400);
      }

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
              start_date,
              start_date,
              end_date,
              start_date,
              end_date,
          ]
      );

      if (overlapping.length > 0) {
          return h.response({
              msg: "You already have a leave request that overlaps with these dates",
          }).code(400);
      }

      const leaveId = await createLeaveRequest({
          user_id,
          leave_type_id,
          start_date,
          end_date,
          reason,
          start_half_day_type,
          end_half_day_type,
          calculatedLeaveDuration
      });

      return h.response({
          msg: `Leave request submitted for ${calculatedLeaveDuration} day(s).`,
          leaveId,
      }).code(201);
  } catch (error) {
      console.error("Error in applyLeave:", error);
      return h.response({ msg: "Something went wrong", error: error.message }).code(500);
  }
};

const getMyLeaveRequests = async (request, h) => {
  const userId = request.pre.auth.id;
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
  const { decision, reason } = request.payload;

  if (!["Approved", "Rejected"].includes(decision)) {
      return h.response({ msg: "Invalid decision" }).code(400);
  }

  if (!["Manager", "HR", "Admin"].includes(role)) {
      return h.response({ msg: "Unauthorized role" }).code(403);
  }

  try {
      const { finalStatus } = await updateLeaveApprovalByRole({
          leaveId: parseInt(leaveId),
          role,
          decision,
          reason,
          approverId,
      });
      return h.response({ msg: `Leave request ${finalStatus} by ${role}.` }).code(200);
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
      const result = await cancelLeaveByUser(leaveId, userId);

      if (!result.success) {
          return h
              .response({ msg: result.message })
              .code(400);
      }

      return h
          .response({ msg: result.message })
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

  const validStatuses = ["Pending", "Approved", "Rejected", "Cancelled"];

  if (!validStatuses.includes(status)) {
      return h
          .response({
              msg: "Invalid status. Must be one of: Pending, Approved, Rejected, Cancelled",
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
      const pendingRequests = await fetchPendingRequestsWithDetails(userId);
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
      const statusDetails = await getLeaveStatusDetails(leaveId);
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