const db = require("./db");

const FULL_DAY = 1;
const FIRST_HALF = 2;
const SECOND_HALF = 3;

const calculateActualLeaveDuration = async (start_date_str, end_date_str, start_half_day_type, end_half_day_type) => {
    const [holidaysRows] = await db.query(`SELECT date FROM holidays`);
    const holidays = holidaysRows.map((h) => h.date.toISOString().split("T")[0]);

    const start = new Date(start_date_str);
    const end = new Date(end_date_str);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    let numDays = 0;

    if (start.getTime() === end.getTime()) {
        const day = start.getDay();
        const dateStr = start.toISOString().split("T")[0];

        if (day !== 0 && day !== 6 && !holidays.includes(dateStr)) {
            if (start_half_day_type === FULL_DAY && end_half_day_type === FULL_DAY) {
                numDays = 1.0;
            } else if (start_half_day_type === FIRST_HALF && end_half_day_type === FIRST_HALF) {
                numDays = 0.5;
            } else if (start_half_day_type === SECOND_HALF && end_half_day_type === SECOND_HALF) {
                numDays = 0.5;
            } else if (start_half_day_type === FIRST_HALF && end_half_day_type === SECOND_HALF) {
                numDays = 1.0;
            }
        }
    } else {
        let currentDate = new Date(start);
        let fullWorkingDays = 0;

        while (currentDate <= end) {
            const day = currentDate.getDay();
            const dateStr = currentDate.toISOString().split("T")[0];

            if (day !== 0 && day !== 6 && !holidays.includes(dateStr)) {
                fullWorkingDays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        numDays = fullWorkingDays;

        const isStartDateWorkingDay = new Date(start_date_str).getDay() !== 0 && new Date(start_date_str).getDay() !== 6 && !holidays.includes(new Date(start_date_str).toISOString().split("T")[0]);
        const isEndDateWorkingDay = new Date(end_date_str).getDay() !== 0 && new Date(end_date_str).getDay() !== 6 && !holidays.includes(new Date(end_date_str).toISOString().split("T")[0]);

        if (isStartDateWorkingDay && start_half_day_type === SECOND_HALF) {
            numDays -= 0.5;
        }
        if (isEndDateWorkingDay && end_half_day_type === FIRST_HALF) {
            numDays -= 0.5;
        }
    }

    return Math.max(0, numDays);
};


const findPendingByUserId = async (userId, role) => {
    let query = "";
    let params = [userId];

    if (role === "Manager") {
        query = `
            SELECT lr.*, u.name AS employee_name, lt.name AS leave_type
            FROM leave_requests lr
            JOIN users u ON lr.user_id = u.id
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lr.user_id = ? AND lr.status = 'Pending' AND lr.manager_approval = 'Pending'
        `;
    } else if (role === "HR") {
        query = `
            SELECT lr.*, u.name AS employee_name, lt.name AS leave_type
            FROM leave_requests lr
            JOIN users u ON lr.user_id = u.id
            JOIN leave_types lt ON lr.leave_type_id = lt.id
            WHERE lr.user_id = ? AND lr.status = 'Pending' AND lr.manager_approval = 'Approved' AND lr.hr_approval = 'Pending'
        `;
    }
    const [rows] = await db.query(query, params);
    return rows;
};

const createLeaveStatusRecords = async (
    leaveRequestId,
    leaveTypeId,
    managerId,
    hrId,
    directorId,
    isDirectorRequired
) => {
    const statusesToInsert = [];

    if (managerId !== null) {
        statusesToInsert.push({
            leave_request_id: leaveRequestId,
            leave_type_id: leaveTypeId,
            approver_id: managerId,
            approver_role: "Manager",
            approval_status: "Pending",
        });
    }

    if (hrId !== null) {
        statusesToInsert.push({
            leave_request_id: leaveRequestId,
            leave_type_id: leaveTypeId,
            approver_id: hrId,
            approver_role: "HR",
            approval_status: "Pending",
        });
    }

    if (directorId !== null && isDirectorRequired) {
        statusesToInsert.push({
            leave_request_id: leaveRequestId,
            leave_type_id: leaveTypeId,
            approver_id: directorId,
            approver_role: "Director",
            approval_status: "Pending",
        });
    }

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

const createLeaveRequest = async ({
    user_id,
    leave_type_id,
    start_date,
    end_date,
    reason,
    start_half_day_type,
    end_half_day_type,
    calculatedLeaveDuration
}) => {
    const [users] = await db.query(
        `SELECT manager_id, hr_id, admin_id, role FROM users WHERE id = ?`,
        [user_id]
    );

    if (users.length === 0) {
        throw new Error("User not found");
    }

    const { manager_id, hr_id, admin_id, role: userRole } = users[0];

    const daysToDeduct = calculatedLeaveDuration;

    if (daysToDeduct > 0) {
        const [balanceRows] = await db.query(
            `SELECT balance FROM leave_balances WHERE user_id = ? AND leave_type_id = ?`,
            [user_id, leave_type_id]
        );

        if (balanceRows.length === 0 || balanceRows[0].balance < daysToDeduct) {
            throw new Error("Insufficient leave balance for this leave type.");
        }

        await db.query(
            `UPDATE leave_balances
             SET balance = balance - ?
             WHERE user_id = ? AND leave_type_id = ?`,
            [daysToDeduct, user_id, leave_type_id]
        );
    }

    const isDirectorRequired = daysToDeduct > 3 || userRole === "HR";

    const directorApprovalStatus = isDirectorRequired
        ? admin_id === null
            ? "Not Required"
            : "Pending"
        : "Not Required";

    const [result] = await db.query(
        `INSERT INTO leave_requests
         (user_id, leave_type_id, start_date, end_date, reason, status, manager_approval, hr_approval, director_approval, user_status, start_half_day_type, end_half_day_type)
         VALUES (?, ?, ?, ?, ?, 'Pending', ?, ?, ?, 'Pending', ?, ?)`,
        [
            user_id,
            leave_type_id,
            start_date,
            end_date,
            reason,
            manager_id === null ? "Not Required" : "Pending",
            hr_id === null ? "Not Required" : "Pending",
            directorApprovalStatus,
            start_half_day_type,
            end_half_day_type,
        ]
    );

    const leaveRequestId = result.insertId;

    await createLeaveStatusRecords(
        leaveRequestId,
        leave_type_id,
        manager_id,
        hr_id,
        admin_id,
        isDirectorRequired
    );

    return leaveRequestId;
};

const getLeaveRequestsByUser = async (userId) => {
    const [rows] = await db.query(
        `SELECT lr.*, lt.name AS leave_type, lr.director_approval, lr.user_status
         FROM leave_requests lr
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.user_id = ?
         ORDER BY lr.created_at DESC`,
        [userId]
    );
    for (const row of rows) {
        row.calculated_days = await calculateActualLeaveDuration(
            row.start_date.toISOString().split('T')[0],
            row.end_date.toISOString().split('T')[0],
            row.start_half_day_type,
            row.end_half_day_type
        );
    }
    return rows;
};

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
    for (const row of rows) {
        row.calculated_days = await calculateActualLeaveDuration(
            row.start_date.toISOString().split('T')[0],
            row.end_date.toISOString().split('T')[0],
            row.start_half_day_type,
            row.end_half_day_type
        );
    }
    return rows;
};

const getLeaveRequestsForAdmin = async () => {
    try {
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
        for (const row of adminRelevantRequests) {
            row.calculated_days = await calculateActualLeaveDuration(
                row.start_date.toISOString().split('T')[0],
                row.end_date.toISOString().split('T')[0],
                row.start_half_day_type,
                row.end_half_day_type
            );
        }
        return adminRelevantRequests;
    } catch (error) {
        console.error("Error fetching leave requests for admin:", error);
        throw error;
    }
};

const updateLeaveStatus = async ({
    leaveRequestId,
    approverRole,
    approvalStatus,
    approvalReason = null,
    approverId,
}) => {
    await db.query(
        `UPDATE leave_status
         SET approval_status = ?, approval_reason = ?, approved_at = NOW()
         WHERE leave_request_id = ? AND approver_role = ? AND approver_id = ?`,
        [approvalStatus, approvalReason, leaveRequestId, approverRole, approverId]
    );
};

const updateLeaveApprovalByRole = async ({
    leaveId,
    role,
    decision,
    reason,
    approverId,
}) => {
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
        throw new Error("Unauthorized role attempting to update leave approval.");
    }

    await db.query(`UPDATE leave_requests SET ${column} = ? WHERE id = ?`, [
        decision,
        leaveId,
    ]);

    await updateLeaveStatus({
        leaveRequestId: leaveId,
        approverRole: approverRoleForStatus,
        approvalStatus: decision,
        approvalReason: reason,
        approverId,
    });

    let [[leave]] = await db.query(
        `SELECT user_id, leave_type_id, start_date, end_date,
                manager_approval, hr_approval, director_approval,
                start_half_day_type, end_half_day_type
         FROM leave_requests WHERE id = ?`,
        [leaveId]
    );

    if (!leave) {
        throw new Error(`Leave request with ID ${leaveId} not found.`);
    }

    let finalStatus = "Pending";

    if (decision === "Rejected") {
        finalStatus = "Rejected";

        await db.query(
            `UPDATE leave_requests SET manager_approval = 'Rejected', hr_approval = 'Rejected', director_approval = 'Rejected' WHERE id = ?`,
            [leaveId]
        );

        [[leave]] = await db.query(
            `SELECT user_id, leave_type_id, start_date, end_date,
                     manager_approval, hr_approval, director_approval,
                     start_half_day_type, end_half_day_type
                    FROM leave_requests WHERE id = ?`,
            [leaveId]
        );

        const workingDaysToReimburse = await calculateActualLeaveDuration(
            leave.start_date.toISOString().split('T')[0],
            leave.end_date.toISOString().split('T')[0],
            leave.start_half_day_type,
            leave.end_half_day_type
        );

        if (workingDaysToReimburse > 0) {
            await db.query(
                `UPDATE leave_balances
                 SET balance = balance + ?
                 WHERE user_id = ? AND leave_type_id = ?`,
                [workingDaysToReimburse, leave.user_id, leave.leave_type_id]
            );
        }

        const rejectionReason = `Cascaded rejection from ${role} (${reason}).`;

        if (
            approverRoleForStatus !== "Manager" &&
            leave.manager_approval !== "Rejected" &&
            leave.manager_approval !== "Not Required"
        ) {
            await updateLeaveStatus({
                leaveRequestId: leaveId,
                approverRole: "Manager",
                approvalStatus: "Rejected",
                approvalReason: rejectionReason,
                approverId: approverId,
            });
        }
        if (
            approverRoleForStatus !== "HR" &&
            leave.hr_approval !== "Rejected" &&
            leave.hr_approval !== "Not Required"
        ) {
            await updateLeaveStatus({
                leaveRequestId: leaveId,
                approverRole: "HR",
                approvalStatus: "Rejected",
                approvalReason: rejectionReason,
                approverId: approverId,
            });
        }
        if (
            approverRoleForStatus !== "Director" &&
            leave.director_approval !== "Rejected" &&
            leave.director_approval !== "Not Required"
        ) {
            await updateLeaveStatus({
                leaveRequestId: leaveId,
                approverRole: "Director",
                approvalStatus: "Rejected",
                approvalReason: rejectionReason,
                approverId: approverId,
            });
        }
    } else {
        [[leave]] = await db.query(
            `SELECT user_id, leave_type_id, start_date, end_date,
                     manager_approval, hr_approval, director_approval,
                     start_half_day_type, end_half_day_type
                    FROM leave_requests WHERE id = ?`,
            [leaveId]
        );

        let allApproved = true;

        if (
            leave.manager_approval === "Rejected" ||
            leave.hr_approval === "Rejected" ||
            leave.director_approval === "Rejected"
        ) {
            finalStatus = "Rejected";
        } else {
            if (
                leave.manager_approval !== "Approved" &&
                leave.manager_approval !== "Not Required"
            ) {
                allApproved = false;
            }
            if (
                leave.hr_approval !== "Approved" &&
                leave.hr_approval !== "Not Required"
            ) {
                allApproved = false;
            }
            if (
                leave.director_approval !== "Not Required" &&
                leave.director_approval !== "Approved"
            ) {
                allApproved = false;
            }

            if (allApproved) {
                finalStatus = "Approved";
            }
        }
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

    return { success: true, finalStatus };
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
    for (const row of rows) {
        row.calculated_days = await calculateActualLeaveDuration(
            row.start_date.toISOString().split('T')[0],
            row.end_date.toISOString().split('T')[0],
            row.start_half_day_type,
            row.end_half_day_type
        );
    }
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
    for (const row of rows) {
        row.calculated_days = await calculateActualLeaveDuration(
            row.start_date.toISOString().split('T')[0],
            row.end_date.toISOString().split('T')[0],
            row.start_half_day_type,
            row.end_half_day_type
        );
    }
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

const cancelLeaveByUser = async (leaveId, userId) => {
    try {
        const [[leaveRequest]] = await db.query(
            `SELECT id, user_id, status, start_date, end_date, leave_type_id, start_half_day_type, end_half_day_type
             FROM leave_requests WHERE id = ? AND user_id = ?`,
            [leaveId, userId]
        );

        if (!leaveRequest) {
            throw new Error("Leave request not found or you are not authorized to cancel it.");
        }

        if (leaveRequest.status === "Rejected" || leaveRequest.status === "Cancelled") {
            throw new Error("This leave request is already " + leaveRequest.status.toLowerCase() + " and cannot be cancelled further.");
        }

        let reimburseDays = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const leaveStartDate = new Date(leaveRequest.start_date);
        leaveStartDate.setHours(0, 0, 0, 0);

        const leaveEndDate = new Date(leaveRequest.end_date);
        leaveEndDate.setHours(0, 0, 0, 0);

        if (leaveRequest.status === "Approved") {
            if (today < leaveStartDate) {
                reimburseDays = await calculateActualLeaveDuration(
                    leaveRequest.start_date,
                    leaveRequest.end_date,
                    leaveRequest.start_half_day_type,
                    leaveRequest.end_half_day_type
                );
            } else if (today >= leaveStartDate && today <= leaveEndDate) {
                const effectiveReimburseStartDate = new Date(today);
                effectiveReimburseStartDate.setDate(today.getDate() + 1);

                if (effectiveReimburseStartDate <= leaveEndDate) {
                    reimburseDays = await calculateActualLeaveDuration(
                        effectiveReimburseStartDate.toISOString().split('T')[0],
                        leaveRequest.end_date.toISOString().split('T')[0],
                        FULL_DAY,
                        leaveRequest.end_half_day_type
                    );
                } else {
                    reimburseDays = 0;
                }

                await db.query(
                    `UPDATE leave_requests
                     SET end_date = ?, end_half_day_type = ?
                     WHERE id = ?`,
                    [today.toISOString().split('T')[0], FULL_DAY, leaveId]
                );
            } else {
                reimburseDays = 0;
            }
        } else {
            reimburseDays = await calculateActualLeaveDuration(
                leaveRequest.start_date,
                leaveRequest.end_date,
                leaveRequest.start_half_day_type,
                leaveRequest.end_half_day_type
            );
        }

        if (reimburseDays > 0) {
            await db.query(
                `UPDATE leave_balances
                 SET balance = balance + ?
                 WHERE user_id = ? AND leave_type_id = ?`,
                [reimburseDays, leaveRequest.user_id, leaveRequest.leave_type_id]
            );
        }

        await db.query(
            `UPDATE leave_requests
             SET status = 'Cancelled', user_status = 'Cancelled'
             WHERE id = ?`,
            [leaveId]
        );

        await db.query(
            `UPDATE leave_status
             SET approval_status = 'Cancelled', approval_reason = 'Cancelled by user', approved_at = NOW()
             WHERE leave_request_id = ? AND (approval_status = 'Pending' OR approval_status = 'Approved')`,
            [leaveId]
        );

        return { success: true, message: "Leave request cancelled successfully." };
    } catch (error) {
        console.error("Error cancelling leave request:", error);
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
    getLeaveStatusDetails,
    calculateActualLeaveDuration,
};