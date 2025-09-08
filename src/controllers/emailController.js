import { run } from "@openai/agents";
// import { gmail } from "../lib/gmailClient.js";
import { emailAgent } from "../agents/emailAgent.js";
import { extractEmailFromHeader, fetchGmailMessage, getAccessToken, gmailRequest } from "../services/gmailService.js";
import { getUserByEmail, updateUserProfile, updateUserTokens } from "../services/authService.js";
import { sendEmailToId } from "../tools/sendEmail.js";
import { saveConversation } from "../tools/getConversation.js";
import { isAppointmentExists, createAppointment } from "../services/appointmentService.js";

// Handle Gmail webhook
export const handleGmailWebhook = async (req, res) => {
    try {
        const encodedData = req.body.message?.data;
        if (!encodedData) {
            return res.status(400).send('Missing data');
        }

        const decodedData = JSON.parse(Buffer.from(encodedData, 'base64').toString());
        console.log("Decoded message data:", decodedData);

        const historyId = parseInt(decodedData.historyId);
        const emailAddress = decodedData.emailAddress;

        if (!emailAddress) {
            return res.status(200).send('Missing emailAddress');
        }

        const user = await getUserByEmail(emailAddress);
        const watchHistoryId = user.watchHistoryId;
        if (!user) {
            return res.status(200).send('User not found');
        }
        const accessToken = user.tokens.accessToken;
        const refreshToken = user.tokens.refreshToken;
        const vectorStoreId = user.vectorStoreId || "";

        // Step 1: Get message history
        const historyRes = await gmailRequest({
            method: 'GET',
            url: `https://gmail.googleapis.com/gmail/v1/users/me/history`,
            params: {
                startHistoryId: watchHistoryId,
                historyTypes: 'messageAdded',
            },
        }, accessToken, refreshToken);

        // Iterate through history and log messages and messagesAdded
        const history = historyRes?.data?.history;
        if (history && Array.isArray(history)) {
            history.forEach((item, index) => {
                console.log(`\n--- History Item ${index} (ID: ${item.id}) ---`);
                console.log("Messages Added:", JSON.stringify(item.messagesAdded, null, 2));
                item.messagesAdded.forEach(async (message) => {
                    await loopFunction(message.message.id, accessToken, refreshToken, watchHistoryId, historyId, emailAddress, user.id, vectorStoreId);
                });
            });
        }

        console.log("--------------------------------");

        return res.status(200);

    } catch (err) {
        console.error('Error in gmail-notify handler:', err);
        res.status(200).send('Failed to process email');
    }
};


const loopFunction = async (messageId, accessToken, refreshToken, watchHistoryId, historyId, emailAddress, userId, vectorStoreId) => {

    const user = await getUserByEmail(emailAddress);
    const tokenExpiresAt = user.tokens.expiryDate;
    const now = Date.now();
    if (tokenExpiresAt < now) {
        const newTokens = await getAccessToken(refreshToken);

        const newExpiryDate = Date.now() + newTokens.expiryDate * 1000;
        updateUserTokens(userId, {
            access_token: newTokens.accessToken,
            expiry_date: newExpiryDate,
            refresh_token: refreshToken,
        });
        accessToken = newTokens.accessToken;
    }

    const message = await fetchGmailMessage({
        messageId,
        accessToken,
        refreshToken,
        format: "full",
    });

    if (message.labelIds.includes("UNREAD") && message.labelIds.includes("INBOX") && message.labelIds.includes("CATEGORY_PERSONAL")) {

        const headers = message.payload.headers;
        const fromEmail = headers.find((h) => h.name === 'From')?.value;
        const from = extractEmailFromHeader(fromEmail);

        const isAppointmentExist = await isAppointmentExists(emailAddress, from);

        console.log("Is appointment exist:", isAppointmentExist);

        if (!isAppointmentExist) {
            await createAppointment(emailAddress, from);
        }

        const subject = headers.find((h) => h.name === 'Subject')?.value;

        let body = '';
        if (message.payload.parts) {
            const bodyPart = message.payload.parts.find((p) => p.mimeType === 'text/plain');
            if (bodyPart?.body?.data) {
                body = Buffer.from(bodyPart.body.data, 'base64').toString();
            } else {
                const fallback = message.payload.parts.find((p) => p.body?.data);
                body = fallback ? Buffer.from(fallback.body.data, 'base64').toString() : 'No message body found.';
            }
        } else if (message.payload.body?.data) {
            body = Buffer.from(message.payload.body.data, 'base64').toString();
        }

        console.log("Email body:", body);

        const input = `{
        "assistantEmail": "${emailAddress}",
        "customerEmail": "${from}",
        "subject": "${subject}",
        "body": "${body}",
        "vectorStoreId": "${vectorStoreId}"}`;

        const result = await run(emailAgent, input);
        console.log("Result:", result.finalOutput);
        const parsedResult = JSON.parse(result.finalOutput);
        console.log("Parsed result:", parsedResult);

        await sendEmailToId(parsedResult.to, parsedResult.subject, parsedResult.body, accessToken, refreshToken);

        await saveConversation(emailAddress, from, "user", {
            subject: subject,
            body: body,
            type: parsedResult.type,
        });

        await saveConversation(emailAddress, from, "assistant", {
            subject: parsedResult.subject,
            body: parsedResult.body,
        });

        if (historyId > watchHistoryId) {
            await updateUserProfile(userId, {
                watchHistoryId: historyId,
            });
        }

        await gmailRequest({
            method: 'POST',
            url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
            data: {
                removeLabelIds: ['UNREAD'],
            },
        }, accessToken, refreshToken);

    }
}