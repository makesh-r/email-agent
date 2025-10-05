import { run } from "@openai/agents";
// import { gmail } from "../lib/gmailClient.js";
import { emailAgent } from "../agents/emailAgent.js";
import { extractEmailFromHeader, fetchGmailMessage, getAccessToken, gmailRequest, setupGmailWatch, stopGmailWatch } from "../services/gmailService.js";
import { getUserByEmail, updateUserProfile, updateUserTokens, getUserById } from "../services/authService.js";
import { sendEmailToId } from "../tools/sendEmail.js";
import { saveConversation } from "../tools/getConversation.js";
import { isAppointmentExists, createAppointment } from "../services/appointmentService.js";
import { sendSuccess } from "../utils/responseUtil.js";

// 🧠 In-memory maps for per-user coordination (replace with Redis for multi-instance)
const processingLocks = new Map();      // Map<email, boolean>
const debounceTimers = new Map();       // Map<email, NodeJS.Timeout>
const pendingHistoryIds = new Map();    // Map<email, number>

/**
 * Gmail Pub/Sub webhook entrypoint.
 * Handles bursts, queues updates during processing, and processes incrementally.
 */
export const handleGmailWebhook = async (req, res) => {
    try {
        const encodedData = req.body.message?.data;
        if (!encodedData) {
            return res.status(400).send('Missing data');
        }

        const decodedData = JSON.parse(Buffer.from(encodedData, 'base64').toString());
        console.log('📩 Decoded Gmail Pub/Sub:', decodedData);

        const historyId = parseInt(decodedData.historyId, 10);
        const emailAddress = decodedData.emailAddress;
        if (!emailAddress) {
            return res.status(200).send('Missing emailAddress');
        }

        // Schedule debounced processing for this mailbox
        scheduleDebouncedProcessing(emailAddress, historyId);

        return res.status(200).send('OK');
    } catch (err) {
        console.error('❌ Error in Gmail webhook handler:', err);
        return res.status(200).send('Failed to process email');
    }
};

/**
 * Schedules Gmail processing after a short debounce window to batch notifications.
 */
function scheduleDebouncedProcessing(email, historyId) {
    // Track the highest historyId received
    const prev = pendingHistoryIds.get(email) || 0;
    pendingHistoryIds.set(email, Math.max(prev, historyId));

    // Reset debounce timer
    if (debounceTimers.has(email)) {
        clearTimeout(debounceTimers.get(email));
    }

    const timer = setTimeout(() => {
        triggerProcessing(email);
        debounceTimers.delete(email);
    }, 3000); // 3-second debounce window

    debounceTimers.set(email, timer);
}

/**
 * Triggers Gmail processing. If already running, new historyIds are just queued.
 */
async function triggerProcessing(email) {
    if (processingLocks.get(email)) {
        console.log(`⏸️ Processing already in progress for ${email}, new historyId queued`);
        return;
    }

    processingLocks.set(email, true);
    try {
        let continueProcessing = true;

        while (continueProcessing) {
            const latestHistoryId = pendingHistoryIds.get(email);
            if (!latestHistoryId) {
                continueProcessing = false;
                break;
            }

            // Remove current pending ID before processing
            pendingHistoryIds.delete(email);

            console.log(`🚀 Processing Gmail changes for ${email} up to historyId ${latestHistoryId}`);
            await processGmailHistory(email, latestHistoryId);

            // If new notifications arrived during processing, loop again
            if (pendingHistoryIds.has(email)) {
                console.log(`🔔 New Gmail changes queued during processing for ${email}, looping again`);
            } else {
                continueProcessing = false;
            }
        }
    } catch (err) {
        console.error(`❌ Processing error for ${email}:`, err);
    } finally {
        processingLocks.delete(email);
    }
}

/**
* Core Gmail history processing for a user.
*/
async function processGmailHistory(email, latestHistoryId) {
    const user = await getUserByEmail(email);
    if (!user) {
        console.warn(`⚠️ User ${email} not found`);
        return;
    }

    const { watchHistoryId, tokens, vectorStoreId } = user;
    const accessToken = tokens.accessToken;
    const refreshToken = tokens.refreshToken;

    // 1️⃣ Fetch Gmail history incrementally
    const historyRes = await gmailRequest(
        {
            method: 'GET',
            url: `https://gmail.googleapis.com/gmail/v1/users/me/history`,
            params: {
                startHistoryId: watchHistoryId,
                historyTypes: 'messageAdded',
            },
        },
        accessToken,
        refreshToken
    );

    const history = historyRes?.data?.history;
    if (!Array.isArray(history)) {
        console.log(`ℹ️ No new history for ${email}`);
        return;
    }

    // 2️⃣ Process each new message sequentially
    for (const item of history) {
        if (item.messagesAdded) {
            for (const msg of item.messagesAdded) {
                const msgId = msg.message.id;

                // const alreadyProcessed = await checkIfMessageProcessed(msgId);
                // if (alreadyProcessed) {
                //     console.log(`🔁 Skipping already processed message ${msgId}`);
                //     continue;
                // }

                await loopFunction(
                    msgId,
                    accessToken,
                    refreshToken,
                    watchHistoryId,
                    latestHistoryId,
                    email,
                    user.id,
                    vectorStoreId || ''
                );

                // await markMessageAsProcessed(msgId);
            }
        }
    }

    // 3️⃣ Update user's historyId to the latest processed
    // await updateUserHistoryId(email, latestHistoryId);
    // console.log(`✅ Updated ${email}'s historyId → ${latestHistoryId}`);
    console.log(`✅ Updated ${email}'s historyId`);
}


// Handle Gmail webhook
export const handleGmailWebhook2 = async (req, res) => {
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

export const handleStartWatch = async (req, res) => {
    const userId = req.params.userId;
    const user = await getUserById(userId);
    const watch = await setupGmailWatch(user.tokens.accessToken);
    await updateUserProfile(userId, {
        watchHistoryId: watch.historyId,
        isGmailWatchEnabled: true
    });
    return sendSuccess(res, 'Watch started');
}

export const handleStopWatch = async (req, res) => {
    const userId = req.params.userId;
    const user = await getUserById(userId);
    const watch = await stopGmailWatch(user.tokens.accessToken);
    await updateUserProfile(userId, {
        isGmailWatchEnabled: false
    });
    return sendSuccess(res, 'Watch stopped');
}