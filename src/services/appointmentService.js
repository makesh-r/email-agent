import { db } from '../lib/firebaseAdmin.js';

const APPOINTMENTS_COLLECTION = 'appointments';

/* appointment object
    {
        id: string;
        assistantEmail: string;
        customerEmail: string;
        status: string;
        createdAt: string;
        updatedAt: string;
        appointmentDateTime: string;
        customerName: string;
        customerPhone: string;
    }
*/

export const createAppointment = async (assistantEmail, customerEmail) => {
    const appointment = {
        assistantEmail: assistantEmail,
        customerEmail: customerEmail,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    const appointmentRef = await db.collection(APPOINTMENTS_COLLECTION).add(appointment);
    await db.collection(APPOINTMENTS_COLLECTION).doc(appointmentRef.id).update({
        id: appointmentRef.id
    });
    return appointmentRef.id;
};

export const isAppointmentDateAvailable = async (assistantEmail, appointmentDateTime) => {
    console.log(`[isAppointmentDateAvailable] Checking if appointment date is available for assistantEmail: ${assistantEmail} and appointmentDateTime: ${appointmentDateTime}`);
    try {
        const appointmentRef = await db.collection(APPOINTMENTS_COLLECTION)
            .where("assistantEmail", "==", assistantEmail)
            .where("status", "==", "CONFIRMED")
            .where("appointmentDateTime", "==", appointmentDateTime)
            .get();
        if (appointmentRef.empty) {
            return true;
        }
        console.log(`[isAppointmentDateAvailable] Appointment date is available for assistantEmail: ${assistantEmail} and appointmentDateTime: ${appointmentDateTime}`);
        return false;
    } catch (error) {
        console.error(`[isAppointmentDateAvailable] Error checking if appointment date is available for assistantEmail: ${assistantEmail} and appointmentDateTime: ${appointmentDateTime}`, error);
        return false;
    }
};

export const bookAppointment = async (assistantEmail, customerEmail, appointmentDateTime, customerName, customerPhone) => {
    console.log(`[bookAppointment] Booking appointment for assistantEmail: ${assistantEmail} and customerEmail: ${customerEmail} and appointmentDateTime: ${appointmentDateTime} and appointmentLocation: ${appointmentLocation}`);
    try {
        const appointmentRef = await db.collection(APPOINTMENTS_COLLECTION)
            .where("assistantEmail", "==", assistantEmail)
            .where("customerEmail", "==", customerEmail)
            .where("status", "==", "PENDING")
            .limit(1)
            .get();
        if (appointmentRef.empty) {
            throw new Error('Appointment not found');
        }
        await db.collection(APPOINTMENTS_COLLECTION).doc(appointmentRef.id).update({
            status: "CONFIRMED",
            updatedAt: new Date().toISOString(),
            appointmentDateTime: appointmentDateTime,
            customerName: customerName || "",
            customerPhone: customerPhone || "",
        });
        console.log(`[bookAppointment] Appointment booked successfully for assistantEmail: ${assistantEmail} and customerEmail: ${customerEmail} and appointmentDateTime: ${appointmentDateTime} and appointmentLocation: ${appointmentLocation}`);
    } catch (error) {
        console.error(`[bookAppointment] Error booking appointment for assistantEmail: ${assistantEmail} and customerEmail: ${customerEmail} and appointmentDateTime: ${appointmentDateTime} and appointmentLocation: ${appointmentLocation}`, error);
        throw error;
    }
};

export const rejectAppointment = async (assistantEmail, customerEmail) => {
    const appointmentRef = await db.collection(APPOINTMENTS_COLLECTION)
        .where("assistantEmail", "==", assistantEmail)
        .where("customerEmail", "==", customerEmail)
        .where("status", "in", ["PENDING", "CONFIRMED"])
        .limit(1)
        .get();
    if (appointmentRef.empty) {
        throw new Error('Appointment not found');
    }
    await db.collection(APPOINTMENTS_COLLECTION).doc(appointmentRef.id).update({
        status: "REJECTED",
        updatedAt: new Date().toISOString(),
    });
};

export const updateAppointmentStatusByEmail = async (assistantEmail, customerEmail, status) => {
    const appointmentRef = await db.collection(APPOINTMENTS_COLLECTION)
        .where("assistantEmail", "==", assistantEmail)
        .where("customerEmail", "==", customerEmail)
        .where("status", "==", "PENDING")
        .limit(1)
        .get();
    if (appointmentRef.empty) {
        throw new Error('Appointment not found');
    }
    await db.collection(APPOINTMENTS_COLLECTION).doc(appointmentRef.id).update({
        status: status,
        updatedAt: new Date().toISOString(),
    });
};

export const getAppointmentById = async (id) => {
    const appointmentRef = await db.collection(APPOINTMENTS_COLLECTION).doc(id).get();
    return {
        id: appointmentRef.id,
        ...appointmentRef.data()
    };
};

export const getAppointmentsByAssistantEmail = async (assistantEmail) => {
    const appointmentsRef = await db.collection(APPOINTMENTS_COLLECTION).where("assistantEmail", "==", assistantEmail).get();
    return appointmentsRef.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};

export const isAppointmentExists = async (assistantEmail, customerEmail) => {
    const appointmentsRef = await db.collection(APPOINTMENTS_COLLECTION)
        .where("assistantEmail", "==", assistantEmail)
        .where("customerEmail", "==", customerEmail)
        .where("status", "==", "PENDING")
        .get();

    if (appointmentsRef.empty) {
        return false;
    }

    return true;

};

export const getConfirmedAppointmentsCount = async (assistantEmail) => {
    const appointmentsRef = await db.collection(APPOINTMENTS_COLLECTION)
        .where("assistantEmail", "==", assistantEmail)
        .where("status", "==", "CONFIRMED")
        .get();
    return appointmentsRef.size;
};

export const getPendingAppointmentsCount = async (assistantEmail) => {
    const appointmentsRef = await db.collection(APPOINTMENTS_COLLECTION)
        .where("assistantEmail", "==", assistantEmail)
        .where("status", "==", "PENDING")
        .get();
    return appointmentsRef.size;
};

export const getRejectedAppointmentsCount = async (assistantEmail) => {
    const appointmentsRef = await db.collection(APPOINTMENTS_COLLECTION)
        .where("assistantEmail", "==", assistantEmail)
        .where("status", "==", "REJECTED")
        .get();
    return appointmentsRef.size;
};

export const getAppointmentsCount = async (assistantEmail) => {
    const appointmentsRef = await db.collection(APPOINTMENTS_COLLECTION)
        .where("assistantEmail", "==", assistantEmail)
        .get();
    return appointmentsRef.size;
};

export const getAppointments = async (assistantEmail) => {
    const appointmentsRef = await db.collection(APPOINTMENTS_COLLECTION)
        .where("assistantEmail", "==", assistantEmail)
        .get();
    return appointmentsRef.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
};