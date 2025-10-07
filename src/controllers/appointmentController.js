import {
    getAppointmentsCount, getConfirmedAppointmentsCount, getPendingAppointmentsCount,
    getRejectedAppointmentsCount, getAppointments
} from "../services/appointmentService.js";
import { getUserById } from "../services/authService.js";
import { sendSuccess, sendError } from "../utils/responseUtil.js";

export const getAppointmentsCountController = async (req, res) => {
    const assistantEmail = req.query.assistantEmail;
    // const user = await getUserById(assistantEmail);
    // if (!user) {
    //     return sendError(res, 'User not found', 404);
    // }
    const count = await getAppointmentsCount(assistantEmail);
    return sendSuccess(res, 'Appointments count fetched successfully', { count });
};

export const getConfirmedAppointmentsCountController = async (req, res) => {
    const assistantEmail = req.query.assistantEmail;
    const count = await getConfirmedAppointmentsCount(assistantEmail);
    return sendSuccess(res, 'Confirmed appointments count fetched successfully', { count });
};

export const getPendingAppointmentsCountController = async (req, res) => {
    const assistantEmail = req.query.assistantEmail;
    const count = await getPendingAppointmentsCount(assistantEmail);
    return sendSuccess(res, 'Pending appointments count fetched successfully', { count });
};

export const getRejectedAppointmentsCountController = async (req, res) => {
    const assistantEmail = req.query.assistantEmail;
    const count = await getRejectedAppointmentsCount(assistantEmail);
    return sendSuccess(res, 'Rejected appointments count fetched successfully', { count });
};

export const getAppointmentsController = async (req, res) => {
    const assistantEmail = req.query.assistantEmail;
    const appointments = await getAppointments(assistantEmail);
    return sendSuccess(res, 'Appointments fetched successfully', { appointments });
};
