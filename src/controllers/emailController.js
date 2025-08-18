import { run } from "@openai/agents";
// import { gmail } from "../lib/gmailClient.js";
import { emailAgent } from "../agents/emailAgent.js";
import { gmailRequest } from "../services/gmailService.js";
import { getUserByEmail } from "../services/authService.js";
import { sendEmailToId } from "../tools/sendEmail.js";
import { saveConversation } from "../tools/getConversation.js";

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

        if (!historyId || !emailAddress) {
            return res.status(400).send('Missing historyId or emailAddress');
        }

        // Step 1: Get history since the given historyId
        // const historyRes = await gmail.users.history.list({
        //     userId: 'me',
        //     startHistoryId: historyId,
        //     historyTypes: ['messageAdded'],
        // });

        const user = await getUserByEmail(emailAddress);
        if (!user) {
            return res.status(400).send('User not found');
        }
        const accessToken = user.tokens.accessToken;
        const refreshToken = user.tokens.refreshToken;
        const vectorStoreId = user.vectorStoreId || "";

        // Step 1: Get message history
        const historyRes = await gmailRequest({
            method: 'GET',
            url: `https://gmail.googleapis.com/gmail/v1/users/me/history`,
            params: {
                startHistoryId: historyId,
                historyTypes: 'messageAdded',
            },
        }, accessToken, refreshToken);

        const messageId = historyRes?.data?.history?.[0]?.messages?.[0]?.id;
        if (!messageId) {
            console.log("No new message found in history.");
            return res.sendStatus(204);
        }

        // Step 2: Get the message details
        // const { data: message } = await gmail.users.messages.get({
        //     userId: 'me',
        //     id: messageId,
        //     format: 'full',
        // });
        // Step 2: Get the message details
        const { data: message } = await gmailRequest({
            method: 'GET',
            url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
            params: { format: 'full' },
        }, accessToken, refreshToken);

        const headers = message.payload.headers;
        const from = headers.find((h) => h.name === 'From')?.value;
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
            "vectorStoreId": "${vectorStoreId}"
        }`;

        // const newHistory = [{
        //     role: 'user',
        //     content: {
        //         subject,
        //         body,
        //     },
        // }];

        const result = await run(emailAgent, input);
        console.log("Result:", result.finalOutput);
        const parsedResult = JSON.parse(result.finalOutput);
        console.log("Parsed result:", parsedResult);

        await sendEmailToId(parsedResult.to, parsedResult.subject, parsedResult.body, accessToken, refreshToken);

        // newHistory.push({
        //     role: 'assistant',
        //     content: {
        //         subject: parsedResult.subject,
        //         body: parsedResult.body,
        //     },
        // });

        await saveConversation(emailAddress, from, "user", {
            subject: subject,
            body: body,
            type: parsedResult.type,
        });

        await saveConversation(emailAddress, from, "assistant", {
            subject: parsedResult.subject,
            body: parsedResult.body,
        });

        // Mark the message as read
        // await gmail.users.messages.modify({
        //     userId: 'me',
        //     id: messageId,
        //     requestBody: {
        //         removeLabelIds: ['UNREAD'],
        //     },
        // });
        // Step 3: Mark as read
        await gmailRequest({
            method: 'POST',
            url: `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
            data: {
                removeLabelIds: ['UNREAD'],
            },
        }, accessToken, refreshToken);

        res.status(200).json({
            message: "Email processed successfully",
            result: result.finalOutput,
        });
    } catch (err) {
        console.error('Error in gmail-notify handler:', err);
        res.status(500).send('Failed to process email');
    }
};
