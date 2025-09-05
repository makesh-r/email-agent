import crypto from 'crypto';
import axios from 'axios';
import { oAuth2Client } from '../lib/gmailClient.js';
import { createUser, getUserByEmail, updateUserLogin } from '../services/authService.js';
import { getGmailUserInfo, setupGmailWatch, getTokens, generateGoogleAuthUrl } from '../services/gmailService.js';
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, GOOGLE_CLIENT_SECRET } from '../lib/config.js';

// Gmail scopes for email access
const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
];

/**
 * Generate OAuth2 authorization URL
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAuthUrl = (req, res) => {
    try {
        // Generate a secure random state value
        const state = crypto.randomBytes(32).toString('hex');

        // Store state in the session
        req.session.state = state;

        // Generate authorization URL
        // const authorizationUrl = oAuth2Client.generateAuthUrl({
        //     access_type: 'offline',
        //     scope: scopes,
        //     include_granted_scopes: true,
        //     state: state,
        //     prompt: 'consent' // Force consent screen to get refresh token
        // });


        const authorizationUrl = generateGoogleAuthUrl({
            clientId: GOOGLE_CLIENT_ID,
            redirectUri: GOOGLE_REDIRECT_URI,
            scopes: scopes,
            state: state
        });

        res.json({
            success: true,
            authUrl: authorizationUrl,
            state: state
        });
    } catch (error) {
        console.error('Error generating auth URL:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate authorization URL'
        });
    }
};

/**
 * Handle OAuth2 callback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const handleCallback = async (req, res) => {
    try {
        const { code, state } = req.body;

        // Verify state parameter to prevent CSRF attacks
        if (state !== req.session.state) {
            return res.status(400).json({
                success: false,
                error: 'Invalid state parameter'
            });
        }
        console.log('code', code);
        // Exchange authorization code for tokens
        const { tokens } = await oAuth2Client.getToken(code);
        // const { tokens } = await getTokens({ code, clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, redirectUri: GOOGLE_REDIRECT_URI });

        console.log('tokens', tokens);

        // Store tokens in session
        req.session.tokens = tokens;
        req.session.isAuthenticated = true;

        const userInfo = await getGmailUserInfo(tokens.access_token);
        await setupGmailWatch(tokens.access_token);

        const user = await getUserByEmail(userInfo.email);
        if (!user) {
            const newUser = await createUser({
                email: userInfo.email,
                name: userInfo.name,
                tokens: tokens
            });
            res.json({
                success: true,
                message: 'Authentication successful',
                user: newUser
            });
        } else {
            const updatedUser = await updateUserLogin(user.id, tokens)
            res.json({
                success: true,
                message: 'Authentication successful',
                user: updatedUser
            });
        }
    } catch (error) {
        console.error('Error handling OAuth callback:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

/**
 * Get Google user profile using axios
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserProfile = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session.isAuthenticated || !req.session.tokens) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please authenticate to access user profile'
            });
        }

        const accessToken = req.session.tokens.access_token;

        // Make HTTP request to Google People API
        const response = await axios.get('https://people.googleapis.com/v1/people/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                personFields: 'names,emailAddresses,photos,metadata'
            }
        });

        const profile = response.data;

        // Extract relevant information
        const userProfile = {
            id: profile.resourceName,
            name: profile.names?.[0]?.displayName || 'Unknown',
            firstName: profile.names?.[0]?.givenName || '',
            lastName: profile.names?.[0]?.familyName || '',
            email: profile.emailAddresses?.[0]?.value || '',
            photoUrl: profile.photos?.[0]?.url || '',
            verified: profile.emailAddresses?.[0]?.metadata?.verified || false,
            lastUpdated: profile.metadata?.sources?.[0]?.updateTime || ''
        };

        res.json({
            success: true,
            profile: userProfile
        });
    } catch (error) {
        console.error('Error getting user profile:', error);

        // Handle specific HTTP errors
        if (error.response?.status === 401) {
            return res.status(401).json({
                success: false,
                error: 'Token expired or invalid',
                message: 'Please re-authenticate to access user profile'
            });
        }

        if (error.response?.status === 403) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: 'Required scopes not granted'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve user profile'
        });
    }
};

/**
 * Get Google user profile with additional details using axios
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getDetailedUserProfile = async (req, res) => {
    try {
        // Check if user is authenticated
        if (!req.session.isAuthenticated || !req.session.tokens) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please authenticate to access user profile'
            });
        }

        const accessToken = req.session.tokens.access_token;

        // Make HTTP request to Google People API
        const response = await axios.get('https://people.googleapis.com/v1/people/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            params: {
                personFields: 'names,emailAddresses,photos,metadata,organizations,phoneNumbers,addresses,birthdays,genders,locales,interests,skills,biographies,urls'
            }
        });

        const profile = response.data;

        // Extract comprehensive information
        const detailedProfile = {
            id: profile.resourceName,
            name: {
                displayName: profile.names?.[0]?.displayName || 'Unknown',
                firstName: profile.names?.[0]?.givenName || '',
                lastName: profile.names?.[0]?.familyName || '',
                middleName: profile.names?.[0]?.middleName || '',
                honorificPrefix: profile.names?.[0]?.honorificPrefix || '',
                honorificSuffix: profile.names?.[0]?.honorificSuffix || ''
            },
            emails: profile.emailAddresses?.map(email => ({
                value: email.value,
                type: email.type,
                verified: email.metadata?.verified || false,
                primary: email.metadata?.primary || false
            })) || [],
            photos: profile.photos?.map(photo => ({
                url: photo.url,
                type: photo.type,
                primary: photo.metadata?.primary || false
            })) || [],
            organizations: profile.organizations?.map(org => ({
                name: org.name,
                title: org.title,
                department: org.department,
                location: org.location,
                primary: org.metadata?.primary || false
            })) || [],
            phoneNumbers: profile.phoneNumbers?.map(phone => ({
                value: phone.value,
                type: phone.type,
                primary: phone.metadata?.primary || false
            })) || [],
            addresses: profile.addresses?.map(address => ({
                formattedValue: address.formattedValue,
                type: address.type,
                primary: address.metadata?.primary || false
            })) || [],
            birthdays: profile.birthdays?.map(birthday => ({
                date: birthday.date,
                text: birthday.text
            })) || [],
            gender: profile.genders?.[0]?.value || '',
            locales: profile.locales?.map(locale => ({
                value: locale.value,
                primary: locale.metadata?.primary || false
            })) || [],
            interests: profile.interests?.map(interest => interest.value) || [],
            skills: profile.skills?.map(skill => skill.value) || [],
            biographies: profile.biographies?.map(bio => ({
                value: bio.value,
                contentType: bio.metadata?.primary ? 'primary' : 'secondary'
            })) || [],
            urls: profile.urls?.map(url => ({
                value: url.value,
                type: url.type,
                primary: url.metadata?.primary || false
            })) || [],
            metadata: {
                lastUpdated: profile.metadata?.sources?.[0]?.updateTime || '',
                source: profile.metadata?.sources?.[0]?.type || ''
            }
        };

        res.json({
            success: true,
            profile: detailedProfile
        });
    } catch (error) {
        console.error('Error getting detailed user profile:', error);

        // Handle specific HTTP errors
        if (error.response?.status === 401) {
            return res.status(401).json({
                success: false,
                error: 'Token expired or invalid',
                message: 'Please re-authenticate to access user profile'
            });
        }

        if (error.response?.status === 403) {
            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: 'Required scopes not granted'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve detailed user profile'
        });
    }
};

/**
 * Check authentication status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const checkAuthStatus = (req, res) => {
    try {
        const isAuthenticated = req.session.isAuthenticated || false;
        const hasTokens = !!(req.session.tokens && req.session.tokens.access_token);

        res.json({
            success: true,
            isAuthenticated,
            hasTokens
        });
    } catch (error) {
        console.error('Error checking auth status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check authentication status'
        });
    }
};

/**
 * Logout user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const logout = (req, res) => {
    try {
        // Clear session
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to logout'
                });
            }

            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        });
    } catch (error) {
        console.error('Error during logout:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to logout'
        });
    }
};