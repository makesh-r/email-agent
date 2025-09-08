import { tool } from '@openai/agents';
import { z } from 'zod';
import { bookAppointment, isAppointmentDateAvailable, rejectAppointment, updateAppointmentStatusByEmail } from '../services/appointmentService.js';

export const updateAppointmentStatusByEmailTool = tool({
    name: 'update_appointment_status_by_email',
    description: 'Update the status of an appointment',
    parameters: z.object({
        assistantEmail: z.string(),
        customerEmail: z.string(),
        status: z.string(),
    }),
    execute: async ({ assistantEmail, customerEmail, status }) => {
        await updateAppointmentStatusByEmail(assistantEmail, customerEmail, status);
        return "Appointment status updated successfully";
    },
});

export const bookAppointmentTool = tool({
    name: 'book_appointment',
    description: 'Book an appointment',
    parameters: z.object({
        assistantEmail: z.string(),
        customerEmail: z.string(),
        appointmentDateTime: z.string(),
        customerName: z.string(),
        customerPhone: z.string(),
    }),
    execute: async ({ assistantEmail, customerEmail, appointmentDateTime, customerName, customerPhone }) => {
        await bookAppointment(assistantEmail, customerEmail, appointmentDateTime, customerName, customerPhone);
        return "Appointment booked successfully";
    },
});

export const rejectAppointmentTool = tool({
    name: 'reject_appointment',
    description: 'Reject an appointment',
    parameters: z.object({
        assistantEmail: z.string(),
        customerEmail: z.string(),
    }),
    execute: async ({ assistantEmail, customerEmail }) => {
        await rejectAppointment(assistantEmail, customerEmail);
        return "Appointment rejected successfully";
    },
});

export const isAppointmentDateAvailableTool = tool({
    name: 'is_appointment_date_available',
    description: 'Check if an appointment date is available',
    parameters: z.object({
        assistantEmail: z.string(),
        appointmentDateTime: z.string(),
    }),
    execute: async ({ assistantEmail, appointmentDateTime }) => {
        return await isAppointmentDateAvailable(assistantEmail, appointmentDateTime);
    },
});

