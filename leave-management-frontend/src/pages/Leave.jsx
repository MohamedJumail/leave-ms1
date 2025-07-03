import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import '../styles/Leave.css';
import LeaveStatusModal from '../components/LeaveStatusModal';
import LeaveHistory from '../components/LeaveHistory'; 
import { FULL_DAY, FIRST_HALF, SECOND_HALF } from '../constants/leaveTypes'; 
const HALF_DAY_MAP = {
    [FULL_DAY]: 'Full Day',
    [FIRST_HALF]: 'First Half ',
    [SECOND_HALF]: 'Second Half',
};

const Leave = () => {
    const { token } = useAuth();

    const [leaves, setLeaves] = useState([]);
    const [leaveTypes, setLeaveTypes] = useState([]);
    const [leaveBalances, setLeaveBalances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [historyVisible, setHistoryVisible] = useState(false);

    const [formErrors, setFormErrors] = useState({});
    const [apiMessage, setApiMessage] = useState("");

    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [selectedLeaveId, setSelectedLeaveId] = useState(null);
    const [leaveStatusDetails, setLeaveStatusDetails] = useState(null);
    const [calculatedLeaveDays, setCalculatedLeaveDays] = useState(0);

    const [formData, setFormData] = useState({
        leave_type_id: "",
        start_date: "",
        end_date: "",
        reason: "",
        start_half_day_type: FULL_DAY,
        end_half_day_type: FULL_DAY,
    });

    const isSingleDayLeave = formData.start_date && formData.end_date &&
                             new Date(formData.start_date).getTime() === new Date(formData.end_date).getTime();

    const fetchLeaveTypes = useCallback(async () => {
        try {
            const response = await api.get("/api/leave-types", {
                headers: { Authorization: `Bearer ${token}` },
            });
            setLeaveTypes(response.data);
        } catch (err) {
            console.error("Error fetching leave types:", err);
            setApiMessage("Failed to load leave types.");
        }
    }, [token]);

    const fetchLeaves = useCallback(async () => {
        try {
            const response = await api.get("/api/leave/my-requests", {
                headers: { Authorization: `Bearer ${token}` },
            });
            setLeaves(response.data);
        } catch (err) {
            console.error("Error fetching leaves:", err);
            setApiMessage("Failed to load leave data.");
        }
    }, [token]);

    const fetchLeaveBalances = useCallback(async () => {
        try {
            const response = await api.get("/api/leave-balances", {
                headers: { Authorization: `Bearer ${token}` },
            });
            setLeaveBalances(response.data);
        } catch (err) {
            console.error("Error fetching leave balances:", err);
            setApiMessage("Failed to load leave balances.");
        }
    }, [token]);

    const fetchLeaveStatus = async (leaveId) => {
        setSelectedLeaveId(leaveId);
        setLeaveStatusDetails(null);
        setIsStatusModalOpen(true);

        try {
            const response = await api.get(`/api/leave/status/${leaveId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setLeaveStatusDetails(response.data);
        } catch (error) {
            console.error("Error fetching leave status:", error);
            setApiMessage("Failed to load leave status.");
            setLeaveStatusDetails([]);
        }
    };

    const calculateFrontendLeaveDuration = useCallback((startDateStr, endDateStr, startHalfDay, endHalfDay) => {
        let currentErrors = {};
        let calculatedDays = 0;

        if (!startDateStr || !endDateStr) {
            return { days: 0, errors: currentErrors };
        }

        const start = new Date(startDateStr);
        const end = new Date(endDateStr);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);

        if (start > end) {
            currentErrors.end_date = "Start date cannot be after end date.";
            return { days: 0, errors: currentErrors };
        }

        let numDays = 0;

        if (start.getTime() === end.getTime()) {
            if (startHalfDay === FULL_DAY && endHalfDay === FULL_DAY) {
                numDays = 1.0;
            } else if (startHalfDay === FIRST_HALF && endHalfDay === SECOND_HALF) {
                numDays = 1.0;
            } else if (startHalfDay === SECOND_HALF && endHalfDay === FIRST_HALF) {
                currentErrors.end_half_day_type = "For a single day, 'End Half-Day' cannot be 'First Half' if 'Start Half-Day' is 'Second Half'.";
                return { days: 0, errors: currentErrors };
            } else if (startHalfDay === FIRST_HALF || startHalfDay === SECOND_HALF) {
                numDays = 0.5;
            }
            if (startHalfDay === FULL_DAY && endHalfDay !== FULL_DAY) {
                currentErrors.start_half_day_type = "For a single day, if 'Full Day' is selected, both start and end half-day types must be 'Full Day'.";
                return { days: 0, errors: currentErrors };
            }
        } else {
            let currentDate = new Date(start);
            while (currentDate <= end) {
                const dayOfWeek = currentDate.getDay();
                if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude weekends
                    numDays++;
                }
                currentDate.setDate(currentDate.getDate() + 1);
            }

            if (startHalfDay === SECOND_HALF) {
                numDays -= 0.5;
            }
            if (endHalfDay === FIRST_HALF) {
                numDays -= 0.5;
            }
        }
        calculatedDays = Math.max(0, numDays);
        return { days: calculatedDays, errors: currentErrors };
    }, []);

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        let updatedFormData = { ...formData, [name]: value };

        setFormErrors(prevErrors => ({ ...prevErrors, [name]: '', general: '' }));
        setApiMessage("");

        if (name === 'start_half_day_type' || name === 'end_half_day_type') {
            updatedFormData = { ...updatedFormData, [name]: parseInt(value, 10) };
        }

        const newStartDate = name === 'start_date' ? value : formData.start_date;
        const newEndDate = name === 'end_date' ? value : formData.end_date;
        const potentialIsSingleDayLeave = newStartDate && newEndDate &&
                                          new Date(newStartDate).getTime() === new Date(newEndDate).getTime();

        if (name === 'start_date' || name === 'end_date') {
            setFormErrors(prevErrors => ({ ...prevErrors, start_date: '', end_date: '' }));

            if (potentialIsSingleDayLeave) {
                updatedFormData.start_half_day_type = FULL_DAY;
                updatedFormData.end_half_day_type = FULL_DAY;
            } else {
                if (isSingleDayLeave) { 
                    updatedFormData.start_half_day_type = FULL_DAY;
                    updatedFormData.end_half_day_type = FULL_DAY;
                }
            }
        }

        if (potentialIsSingleDayLeave && name === 'start_half_day_type') {
            updatedFormData.end_half_day_type = parseInt(value, 10);
            setFormErrors(prevErrors => ({ ...prevErrors, start_half_day_type: '', end_half_day_type: '' }));
        } else if (!potentialIsSingleDayLeave && (name === 'start_half_day_type' || name === 'end_half_day_type')) {
             setFormErrors(prevErrors => ({ ...prevErrors, [name]: '' }));
        }

        setFormData(updatedFormData);

        if (['start_date', 'end_date', 'start_half_day_type', 'end_half_day_type'].includes(name)) {
            const { days, errors: calcErrors } = calculateFrontendLeaveDuration(
                updatedFormData.start_date,
                updatedFormData.end_date,
                updatedFormData.start_half_day_type,
                updatedFormData.end_half_day_type
            );
            setCalculatedLeaveDays(days);
            setFormErrors(prev => ({ ...prev, ...calcErrors }));
        }
    };

    useEffect(() => {
        if (formData.start_date && formData.end_date) {
            const { days, errors: calcErrors } = calculateFrontendLeaveDuration(
                formData.start_date,
                formData.end_date,
                formData.start_half_day_type,
                formData.end_half_day_type
            );
            setCalculatedLeaveDays(days);
            setFormErrors(prev => ({ ...prev, ...calcErrors }));
        } else {
            setCalculatedLeaveDays(0);
            setFormErrors(prevErrors => ({
                ...prevErrors,
                start_date: '',
                end_date: '',
                start_half_day_type: '',
                end_half_day_type: ''
            }));
        }
    }, [formData.start_date, formData.end_date, formData.start_half_day_type, formData.end_half_day_type, calculateFrontendLeaveDuration]);

    useEffect(() => {
        if (token) {
            Promise.all([
                fetchLeaveTypes(),
                fetchLeaves(),
                fetchLeaveBalances(),
            ]).finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [token, fetchLeaveTypes, fetchLeaves, fetchLeaveBalances]);

    const submitLeaveRequest = async (e) => {
        e.preventDefault();
        setApiMessage("");
        setFormErrors({});

        let errors = {};

        if (!formData.leave_type_id) errors.leave_type_id = "Leave type is required.";
        if (!formData.start_date) errors.start_date = "Start date is required.";
        if (!formData.end_date) errors.end_date = "End date is required.";
        if (!formData.reason) errors.reason = "Reason is required.";

        const { days: finalCalculatedDays, errors: calcErrors } = calculateFrontendLeaveDuration(
            formData.start_date,
            formData.end_date,
            formData.start_half_day_type,
            formData.end_half_day_type
        );
        setCalculatedLeaveDays(finalCalculatedDays);

        errors = { ...errors, ...calcErrors };

        if (finalCalculatedDays <= 0 && formData.start_date && formData.end_date && Object.keys(calcErrors).length === 0) {
            errors.general = "The selected leave period results in zero or negative working days/hours. Please check dates and half-day selections.";
        }

        const selectedLeaveType = leaveTypes.find(lt => lt.id === Number(formData.leave_type_id));
        const selectedBalance = leaveBalances.find(b =>
            selectedLeaveType && b.leave_type.trim().toLowerCase() === selectedLeaveType.name.trim().toLowerCase()
        );

        if (!selectedBalance) {
            errors.leave_type_id = "Selected leave type balance not found.";
        } else if (finalCalculatedDays > 0 && finalCalculatedDays > selectedBalance.balance) {
            errors.leave_type_id = `Insufficient leave balance. You need ${finalCalculatedDays} days, but have ${selectedBalance.balance} days available.`;
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            setApiMessage("Please correct the errors in the form.");
            return;
        }

        const formDataToSend = {
            ...formData,
            leave_type_id: Number(formData.leave_type_id),
        };

        try {
            const response = await api.post("/api/leave/apply", formDataToSend, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setApiMessage(response.data.msg);
            setFormData({
                leave_type_id: "",
                start_date: "",
                end_date: "",
                reason: "",
                start_half_day_type: FULL_DAY,
                end_half_day_type: FULL_DAY,
            });
            setCalculatedLeaveDays(0);
            fetchLeaves();
            fetchLeaveBalances();
        } catch (err) {
            console.error("Error submitting leave request:", err);
            if (err.response) {
                if (err.response.data.errors) {
                    setFormErrors(err.response.data.errors);
                    setApiMessage("Please correct the errors in the form.");
                } else {
                    setApiMessage(err.response.data.msg || err.response.data.error || "Could not submit leave request.");
                }
            } else {
                setApiMessage("Could not submit leave request due to a network error.");
            }
        }
    };

    const cancelLeave = async (leaveId) => {
        if (!window.confirm("Are you sure you want to cancel this leave request?")) {
            return;
        }
        setApiMessage("");
        try {
            const response = await api.put(
                `/api/leave/cancel/${leaveId}`,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setApiMessage(response.data.msg);
            fetchLeaves();
            fetchLeaveBalances();
        } catch (err) {
            console.error("Error cancelling leave:", err);
            if (err.response) {
                setApiMessage(err.response.data.msg || err.response.data.error || "Could not cancel leave.");
            } else {
                setApiMessage("Could not cancel leave due to a network error.");
            }
        }
    };

    const closeStatusModal = () => {
        setIsStatusModalOpen(false);
        setSelectedLeaveId(null);
        setLeaveStatusDetails(null);
    };

    if (loading) return <p>Loading leave data...</p>;

    return (
        <div className="leave-container">
            <h2 className="balances-heading">Leave Balances</h2>
            <div className="leave-balances-container" aria-label="Leave Balances">
                {leaveBalances.map(({ id, leave_type, balance }) => (
                    <div key={id} className="leave-balance-card" title={`${leave_type} Balance`}>
                        <h4>{leave_type}</h4>
                        <p>{balance} days</p>
                    </div>
                ))}
            </div>

            <div className="header-row">
                <h2>Apply for Leave</h2>
                <button
                    onClick={() => setHistoryVisible(!historyVisible)}
                    className="yellow-btn"
                    type="button"
                    aria-label="Toggle Leave History"
                >
                    {historyVisible ? "Hide Leave History" : "View Leave History"}
                </button>
            </div>

            {!historyVisible ? (
                <>
                    <form onSubmit={submitLeaveRequest} className="leave-form">
                        <div className="form-group">
                            <label htmlFor="leave_type_id">Leave Type:</label>
                            <select
                                id="leave_type_id"
                                name="leave_type_id"
                                value={formData.leave_type_id}
                                onChange={handleFormChange}
                                required
                                className={formErrors.leave_type_id ? 'input-error' : ''}
                            >
                                <option value="">Select</option>
                                {leaveTypes.map((type) => {
                                    const balanceInfo = leaveBalances.find(
                                        (balance) => balance.leave_type === type.name
                                    );
                                    const balance = balanceInfo ? balanceInfo.balance : 'N/A';
                                    return (
                                        <option key={type.id} value={type.id}>
                                            {type.name} ({balance} days)
                                        </option>
                                    );
                                })}
                            </select>
                            {formErrors.leave_type_id && <p className="error-message">{formErrors.leave_type_id}</p>}
                        </div>
                        <div className="form-group">
                            <label htmlFor="start_date">Start Date:</label>
                            <input
                                id="start_date"
                                type="date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleFormChange}
                                required
                                className={formErrors.start_date ? 'input-error' : ''}
                            />
                            {formErrors.start_date && <p className="error-message">{formErrors.start_date}</p>}
                        </div>
                        <div className="form-group">
                            <label htmlFor="end_date">End Date:</label>
                            <input
                                id="end_date"
                                type="date"
                                name="end_date"
                                value={formData.end_date}
                                onChange={handleFormChange}
                                required
                                className={formErrors.end_date ? 'input-error' : ''}
                            />
                            {formErrors.end_date && <p className="error-message">{formErrors.end_date}</p>}
                        </div>

                        {isSingleDayLeave ? (
                            <div className="form-group">
                                <label htmlFor="single_day_half_type">Half-Day Type:</label>
                                <select
                                    id="single_day_half_type"
                                    name="start_half_day_type"
                                    value={formData.start_half_day_type}
                                    onChange={handleFormChange}
                                    required
                                    className={formErrors.start_half_day_type ? 'input-error' : ''}
                                >
                                    <option value={FULL_DAY}>{HALF_DAY_MAP[FULL_DAY]}</option>
                                    <option value={FIRST_HALF}>{HALF_DAY_MAP[FIRST_HALF]}</option>
                                    <option value={SECOND_HALF}>{HALF_DAY_MAP[SECOND_HALF]}</option>
                                </select>
                                {formErrors.start_half_day_type && <p className="error-message">{formErrors.start_half_day_type}</p>}
                            </div>
                        ) : (
                            <>
                                <div className="form-group">
                                    <label htmlFor="start_half_day_type">Start Day Half:</label>
                                    <select
                                        id="start_half_day_type"
                                        name="start_half_day_type"
                                        value={formData.start_half_day_type}
                                        onChange={handleFormChange}
                                        required
                                        className={formErrors.start_half_day_type ? 'input-error' : ''}
                                    >
                                        <option value={FULL_DAY}>{HALF_DAY_MAP[FIRST_HALF]}</option>
                                        <option value={SECOND_HALF}>{HALF_DAY_MAP[SECOND_HALF]}</option>
                                    </select>
                                    {formErrors.start_half_day_type && <p className="error-message">{formErrors.start_half_day_type}</p>}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="end_half_day_type">End Day Half:</label>
                                    <select
                                        id="end_half_day_type"
                                        name="end_half_day_type"
                                        value={formData.end_half_day_type}
                                        onChange={handleFormChange}
                                        required
                                        className={formErrors.end_half_day_type ? 'input-error' : ''}
                                    >
                                        <option value={FIRST_HALF}>{HALF_DAY_MAP[FIRST_HALF]}</option>
                                        <option value={FULL_DAY}>{HALF_DAY_MAP[SECOND_HALF]}</option>
                                    </select>
                                    {formErrors.end_half_day_type && <p className="error-message">{formErrors.end_half_day_type}</p>}
                                </div>
                            </>
                        )}

                        {formData.start_date && formData.end_date && (
                            <div className="form-group">
                                <label>Estimated Leave Days:</label>
                                <p>{calculatedLeaveDays}</p>
                            </div>
                        )}
                        <div className="form-group">
                            <label htmlFor="reason">Reason:</label>
                            <textarea
                                id="reason"
                                name="reason"
                                value={formData.reason}
                                onChange={handleFormChange}
                                required
                                rows="3"
                                placeholder="Provide a reason for your leave"
                                className={formErrors.reason ? 'input-error' : ''}
                            />
                            {formErrors.reason && <p className="error-message">{formErrors.reason}</p>}
                        </div>

                        {apiMessage && <p className={`api-message ${apiMessage.includes("Error") || apiMessage.includes("Failed") || apiMessage.includes("Could not") || apiMessage.includes("Please correct") ? "error-text" : "success-text"}`}>{apiMessage}</p>}
                        {formErrors.general && <p className="error-text">{formErrors.general}</p>}

                        <button type="submit" className="yellow-btn submit-btn">
                            Submit Leave
                        </button>
                    </form>

                    <h3 style={{ color: "#1DA1F2", marginBottom: "1rem" }}>
                        Pending Leave Requests
                    </h3>
                    {leaves.filter(leave => leave.status === 'Pending').length > 0 ? (
                        <LeaveHistory
                            leaves={leaves.filter(leave => leave.status === 'Pending')}
                            fetchLeaveStatus={fetchLeaveStatus}
                            cancelLeave={cancelLeave}
                        />
                    ) : (
                        <p className="status-text">No pending leave requests found.</p>
                    )}
                </>
            ) : (
                <LeaveHistory
                    leaves={leaves}
                    fetchLeaveStatus={fetchLeaveStatus}
                    cancelLeave={cancelLeave}
                />
            )}

            <LeaveStatusModal
                isOpen={isStatusModalOpen}
                onRequestClose={closeStatusModal}
                leaveId={selectedLeaveId}
                leaveStatusDetails={leaveStatusDetails}
            />
        </div>
    );
};

export default Leave;