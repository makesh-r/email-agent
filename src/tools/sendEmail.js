import { tool } from '@openai/agents';
import { z } from 'zod';
// import { gmail } from '../lib/gmailClient.js';
import axios from 'axios';
import { getAccessToken } from '../services/gmailService.js';

// async function sendEmailToId(to, subject, text) {
//     console.log(`[sendEmailToId] Preparing email for ${to}`);
//     const raw = Buffer.from(`To: ${to}\nSubject: ${subject}\n\n${text}`)
//         .toString('base64')
//         .replace(/\+/g, '-')
//         .replace(/\//g, '_')
//         .replace(/=+$/, '');

//     console.log(`[sendEmailToId] Sending email to ${to}`);
//     await gmail.users.messages.send({
//         userId: 'me',
//         requestBody: { raw },
//     });
//     console.log(`[sendEmailToId] Successfully sent email to ${to}`);
// }

// Send email to the given ID, with fallback if access token is expired
export const sendEmailToId = async (to, subject, text, accessToken, refreshToken, retry = false) => {
    console.log(`[sendEmailToId] Preparing email for ${to}`);

    const rawMessage = Buffer.from(
        `To: ${to}\r\n` +
        `Subject: ${subject}\r\n\r\n` +
        `${text}`
    )
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    try {
        console.log(`[sendEmailToId] Attempting to send email to ${to}`);
        const response = await axios.post(
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            { raw: rawMessage },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log(`[sendEmailToId] Email successfully sent to ${to}`, response.data.id);
    } catch (error) {
        const status = error.response?.status;
        const isUnauthorized = status === 401;

        if (isUnauthorized && !retry) {
            console.warn(`[sendEmailToId] Access token expired. Refreshing token and retrying...`);
            const newAccessToken = await getAccessToken(refreshToken);
            return sendEmailToId(to, subject, text, newAccessToken, refreshToken, true);
        }

        console.error(`[sendEmailToId] Failed to send email to ${to}:`, error.response?.data || error.message);
        throw error;
    }
}

export const sendEmail = tool({
    name: 'send_email',
    description: 'Send an email to a customer',
    parameters: z.object({
        to: z.string().email(),
        subject: z.string(),
        body: z.string(),
    }),
    execute: async ({ to, subject, body }) => {
        console.log(`[sendEmail] Starting email send process to ${to}`);
        try {
            await sendEmailToId(to, subject, body);
            console.log(`📧 [sendEmail] Success - Email sent to: ${to}, Subject: ${subject}`);
            return `Email sent to ${to}`;
        } catch (error) {
            console.error(`[sendEmail] Error sending email to ${to}:`, error);
            throw error;
        }
    },
});
