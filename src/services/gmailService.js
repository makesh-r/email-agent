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
            const newToken = await getAccessToken(refreshToken);
            return gmailRequest(config, newToken, refreshToken, true);
        }
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

        return response.data.access_token;
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
    } catch (error) {
        console.error('Watch setup failed:', error.response?.data || error.message);
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
