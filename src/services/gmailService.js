import axios from 'axios';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../lib/config.js';

// Replace these with your actual credentials
const TOPIC_NAME = 'projects/wp-mcp-93b69/topics/gmail-inbox-updates';

export function generateGoogleAuthUrl({ clientId, redirectUri, scopes, state }) {
    const baseUrl = "https://accounts.google.com/o/oauth2/v2/auth";

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        access_type: "offline",
        include_granted_scopes: "true",
        state,
        prompt: "consent",
    });

    return `${baseUrl}?${params.toString()}`;
}

export async function getTokens({ code, clientId, clientSecret, redirectUri }) {
    const url = "https://oauth2.googleapis.com/token";

    const body = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
    });

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });

    if (!res.ok) {
        throw new Error(`Token exchange failed: ${res} ${res.status} ${await res.text()}`);
    }

    return res.json(); // { access_token, refresh_token, expires_in, id_token, ... }
}

export async function fetchGmailMessage({
    messageId,
    accessToken,
    refreshToken,
    format = "full",
}) {
    console.log("Fetching Gmail message:", messageId);
    if (!messageId) throw new Error("messageId is required");
    if (!accessToken) throw new Error("accessToken is required");
    if (!refreshToken) throw new Error("refreshToken is required");

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
    let token = accessToken;

    // Minimal retry policy
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const res = await axios.get(url, {
                params: { format },
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                timeout: 20000,
            });
            return res.data; // <- the Gmail message
        } catch (err) {
            const status = err?.response?.status;

            // If unauthorized and we haven't refreshed yet, refresh once and retry immediately
            if (status === 401 && attempt === 1) {
                try {
                    newTokens = await getAccessToken(refreshToken);
                    token = newTokens.accessToken;
                    continue; // retry now with the new token
                } catch (refreshErr) {
                    refreshErr.message = `[fetchGmailMessage] Failed to refresh access token: ${refreshErr.message}`;
                    throw refreshErr;
                }
            }

            // Handle rate limiting / transient server errors with backoff
            if (status === 429 || (status >= 500 && status < 600)) {
                const retryAfterHeader = err.response?.headers?.["retry-after"];
                const retryAfterMs = retryAfterHeader
                    ? Number(retryAfterHeader) * 1000
                    : Math.min(1000 * Math.pow(2, attempt - 1), 8000); // 1s, 2s, 4s
                if (attempt < maxAttempts) {
                    await new Promise(r => setTimeout(r, retryAfterMs));
                    continue;
                }
            }

            // Anything else (or retries exhausted): throw with context
            const details = err.response?.data || err.message || err.toString();
            const msg = `[fetchGmailMessage] Request failed (attempt ${attempt}/${maxAttempts}) with status ${status || "unknown"}: ${typeof details === "string" ? details : JSON.stringify(details)}`;
            const wrapped = new Error(msg);
            wrapped.cause = err;
            throw wrapped;
        }
    }

    // Should never get here
    throw new Error("[fetchGmailMessage] Exhausted retries unexpectedly.");
}

// Make Gmail API call with auto-refresh on 401
export const gmailRequest = async (config, accessToken, refreshToken, retry = false) => {
    try {
        const res = await axios({
            ...config,
            headers: {
                ...(config.headers || {}),
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        return res;
    } catch (err) {
        const status = err.response?.status;
        if (status === 401 && !retry) {
            console.warn('[gmailRequest] Access token expired, retrying...');
            const newTokens = await getAccessToken(refreshToken);
            return gmailRequest(config, newTokens.accessToken, refreshToken, true);
        }
        console.error('Gmail request error:', err);
        throw err;
    }
}

export const getAccessToken = async (refreshToken) => {
    try {
        const response = await axios.post('https://oauth2.googleapis.com/token', null, {
            params: {
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            },
        });
        console.log("Refresh token response:", response.data);

        return {
            accessToken: response.data.access_token,
            expiryDate: response.data.expires_in,
        }
    } catch (error) {
        console.error('Failed to fetch access token:', error.response?.data || error.message);
        throw error;
    }
}

export const setupGmailWatch = async (accessToken) => {
    try {

        const response = await axios.post(
            'https://gmail.googleapis.com/gmail/v1/users/me/watch',
            {
                labelIds: ['INBOX'],
                topicName: TOPIC_NAME,
            },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        console.log('Watch setup successful:', response.data);
        return response.data;
    } catch (error) {
        console.error('Watch setup failed:', error.response?.data || error.message);
        return null;
    }
}

export const stopGmailWatch = async (accessToken) => {
    try {
        await axios.post(`https://gmail.googleapis.com/gmail/v1/users/me/stop`, {}, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });
        console.log("Existing watch stopped (if any).");
        return true;
    } catch (err) {
        // /stop is safe to call even if nothing exists; log and continue
        const msg = err.response?.data || err.message;
        console.warn("Stopping watch failed (likely none active):", msg);
        return null;
    }
}

export const getGmailUserInfo = async (accessToken) => {
    try {
        const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        const userInfo = response.data;

        const formattedUserInfo = {
            id: userInfo.id,
            email: userInfo.email,
            verifiedEmail: userInfo.verified_email,
            name: userInfo.name,
            givenName: userInfo.given_name,
            familyName: userInfo.family_name,
            picture: userInfo.picture,
            locale: userInfo.locale,
            hd: userInfo.hd // Hosted domain (for Google Workspace users)
        };

        return formattedUserInfo;

    } catch (error) {
        console.error('Error getting user info:', error);

        if (error.response?.status === 401) {
            return null;
        }

        return null;
    }
};

export const extractEmailFromHeader = (emailString) => {
    const match = emailString.match(/<([^>]+)>/);
    return match ? match[1] : emailString;
}