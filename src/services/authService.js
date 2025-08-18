import { db } from '../lib/firebaseAdmin.js';
import crypto from 'crypto';

const USERS_COLLECTION = 'users';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here';
const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt sensitive data using Node.js built-in crypto module
 * @param {string} text - Text to encrypt
 * @returns {string} Encrypted text
 */
// const encrypt = (text) => {
//     try {
//         const iv = crypto.randomBytes(16);
//         // Use createCipheriv with proper key derivation
//         const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
//         const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
//         let encrypted = cipher.update(text, 'utf8', 'hex');
//         encrypted += cipher.final('hex');
//         return iv.toString('hex') + ':' + encrypted;
//     } catch (error) {
//         console.error('Encryption error:', error);
//         throw new Error('Failed to encrypt data');
//     }
// };

/**
 * Decrypt sensitive data using Node.js built-in crypto module
 * @param {string} encryptedText - Encrypted text to decrypt
 * @returns {string} Decrypted text
 */
// const decrypt = (encryptedText) => {
//     try {
//         const textParts = encryptedText.split(':');
//         const iv = Buffer.from(textParts.shift(), 'hex');
//         const encryptedData = textParts.join(':');
//         // Use createDecipheriv with proper key derivation
//         const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
//         const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
//         let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
//         decrypted += decipher.final('utf8');
//         return decrypted;
//     } catch (error) {
//         console.error('Decryption error:', error);
//         throw new Error('Failed to decrypt data');
//     }
// };

/**
 * Encrypt tokens object
 * @param {Object} tokens - Tokens to encrypt
 * @returns {Object} Encrypted tokens
 */
const encryptTokens = (tokens) => {
    return tokens;
    // return {
    //     accessToken: encrypt(tokens.accessToken),
    //     refreshToken: encrypt(tokens.refreshToken),
    //     expiryDate: tokens.expiryDate // Keep as is since it's a date
    // };
};

/**
 * Decrypt tokens object
 * @param {Object} encryptedTokens - Encrypted tokens to decrypt
 * @returns {Object} Decrypted tokens
 */
const decryptTokens = (encryptedTokens) => {
    return encryptedTokens;
    // return {
    //     accessToken: decrypt(encryptedTokens.accessToken),
    //     refreshToken: decrypt(encryptedTokens.refreshToken),
    //     expiryDate: encryptedTokens.expiryDate // Keep as is since it's a date
    // };
};

/**
 * Create a new user in Firebase
 */
export const createUser = async (userData) => {
    try {
        const userDoc = {
            emailId: userData.email,
            name: userData.name,
            tokens: encryptTokens({
                accessToken: userData.tokens.access_token,
                refreshToken: userData.tokens.refresh_token,
                expiryDate: userData.tokens.expiry_date
            }),
            isActive: true,
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLoginAt: new Date()
        };

        const docRef = await db.collection(USERS_COLLECTION).add(userDoc);

        // Update the document to include the id field in the database
        await db.collection(USERS_COLLECTION).doc(docRef.id).update({
            id: docRef.id
        });

        return {
            id: docRef.id,
            ...userDoc,
            tokens: {
                accessToken: userData.tokens.access_token,
                refreshToken: userData.tokens.refresh_token,
                expiryDate: userData.tokens.expiry_date
            }
        };
    } catch (error) {
        console.error('Error creating user:', error);
        throw new Error('Failed to create user in database');
    }
};

/**
 * Check if user exists by email
 * @param {string} email - User's email address
 * @returns {Promise<Object|null>} User document if exists, null otherwise
 */
export const getUserByEmail = async (email) => {
    try {
        const snapshot = await db.collection(USERS_COLLECTION)
            .where('email', '==', email)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        const userData = doc.data();

        return {
            id: doc.id,
            ...userData,
            tokens: userData.tokens ? decryptTokens(userData.tokens) : null
        };
    } catch (error) {
        console.error('Error getting user by email:', error);
        throw new Error('Failed to check user existence');
    }
};

/**
 * Update user's last login time and tokens
 * @param {string} userId - User document ID
 * @param {Object} tokens - Updated OAuth tokens
 * @returns {Promise<Object>} Updated user document
 */
export const updateUserLogin = async (userId, tokens) => {
    try {
        const updateData = {
            lastLoginAt: new Date(),
            updatedAt: new Date(),
            tokens: encryptTokens({
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiryDate: tokens.expiry_date
            })
        };

        await db.collection(USERS_COLLECTION).doc(userId).update(updateData);

        // Get updated user document
        const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
        const userData = doc.data();

        return {
            id: doc.id,
            ...userData,
            tokens: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiryDate: tokens.expiry_date
            }
        };
    } catch (error) {
        console.error('Error updating user login:', error);
        throw new Error('Failed to update user login');
    }
};

/**
 * Update user profile information
 * @param {string} userId - User document ID
 * @param {Object} profileData - Profile data to update
 * @returns {Promise<Object>} Updated user document
 */
export const updateUserProfile = async (userId, profileData) => {
    try {
        const updateData = {
            ...profileData,
            updatedAt: new Date()
        };

        await db.collection(USERS_COLLECTION).doc(userId).update(updateData);

        // Get updated user document
        const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
        const userData = doc.data();

        return {
            id: doc.id,
            ...userData,
            tokens: userData.tokens ? decryptTokens(userData.tokens) : null
        };
    } catch (error) {
        console.error('Error updating user profile:', error);
        throw new Error('Failed to update user profile');
    }
};

/**
 * Get user by document ID
 * @param {string} userId - User document ID
 * @returns {Promise<Object|null>} User document if exists, null otherwise
 */
export const getUserById = async (userId) => {
    try {
        const doc = await db.collection(USERS_COLLECTION).doc(userId).get();

        if (!doc.exists) {
            return null;
        }

        const userData = doc.data();

        return {
            id: doc.id,
            ...userData,
            tokens: userData.tokens ? decryptTokens(userData.tokens) : null
        };
    } catch (error) {
        console.error('Error getting user by ID:', error);
        throw new Error('Failed to get user');
    }
};

/**
 * Get user tokens (decrypted)
 * @param {string} userId - User document ID
 * @returns {Promise<Object|null>} Decrypted tokens or null
 */
export const getUserTokens = async (userId) => {
    try {
        const doc = await db.collection(USERS_COLLECTION).doc(userId).get();

        if (!doc.exists) {
            return null;
        }

        const userData = doc.data();
        return userData.tokens ? decryptTokens(userData.tokens) : null;
    } catch (error) {
        console.error('Error getting user tokens:', error);
        throw new Error('Failed to get user tokens');
    }
};

/**
 * Update user tokens
 * @param {string} userId - User document ID
 * @param {Object} tokens - New OAuth tokens
 * @returns {Promise<Object>} Updated user document
 */
export const updateUserTokens = async (userId, tokens) => {
    try {
        const updateData = {
            updatedAt: new Date(),
            tokens: encryptTokens({
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiryDate: tokens.expiry_date
            })
        };

        await db.collection(USERS_COLLECTION).doc(userId).update(updateData);

        // Get updated user document
        const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
        const userData = doc.data();

        return {
            id: doc.id,
            ...userData,
            tokens: {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiryDate: tokens.expiry_date
            }
        };
    } catch (error) {
        console.error('Error updating user tokens:', error);
        throw new Error('Failed to update user tokens');
    }
};

/**
 * Deactivate user account
 * @param {string} userId - User document ID
 * @returns {Promise<Object>} Updated user document
 */
export const deactivateUser = async (userId) => {
    try {
        const updateData = {
            isActive: false,
            updatedAt: new Date(),
            deactivatedAt: new Date()
        };

        await db.collection(USERS_COLLECTION).doc(userId).update(updateData);

        // Get updated user document
        const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
        const userData = doc.data();

        return {
            id: doc.id,
            ...userData,
            tokens: userData.tokens ? decryptTokens(userData.tokens) : null
        };
    } catch (error) {
        console.error('Error deactivating user:', error);
        throw new Error('Failed to deactivate user');
    }
};

/**
 * Reactivate user account
 * @param {string} userId - User document ID
 * @returns {Promise<Object>} Updated user document
 */
export const reactivateUser = async (userId) => {
    try {
        const updateData = {
            isActive: true,
            updatedAt: new Date(),
            reactivatedAt: new Date()
        };

        await db.collection(USERS_COLLECTION).doc(userId).update(updateData);

        // Get updated user document
        const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
        const userData = doc.data();

        return {
            id: doc.id,
            ...userData,
            tokens: userData.tokens ? decryptTokens(userData.tokens) : null
        };
    } catch (error) {
        console.error('Error reactivating user:', error);
        throw new Error('Failed to reactivate user');
    }
};

/**
 * Delete user account permanently
 * @param {string} userId - User document ID
 * @returns {Promise<Object>} Updated user document
 */
export const deleteUser = async (userId) => {
    try {
        const updateData = {
            isDeleted: true,
            updatedAt: new Date(),
            deletedAt: new Date()
        };

        await db.collection(USERS_COLLECTION).doc(userId).update(updateData);

        // Get updated user document
        const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
        const userData = doc.data();

        return {
            id: doc.id,
            ...userData,
            tokens: userData.tokens ? decryptTokens(userData.tokens) : null
        };
    } catch (error) {
        console.error('Error deleting user:', error);
        throw new Error('Failed to delete user');
    }
};

/**
 * Get all active users
 * @param {number} limit - Maximum number of users to return
 * @param {string} startAfter - Document ID to start after (for pagination)
 * @returns {Promise<Array>} Array of active users
 */
export const getActiveUsers = async (limit = 50, startAfter = null) => {
    try {
        let query = db.collection(USERS_COLLECTION)
            .where('isDeleted', '==', false)
            .where('isActive', '==', true)
            .orderBy('createdAt', 'desc')
            .limit(limit);

        if (startAfter) {
            const startDoc = await db.collection(USERS_COLLECTION).doc(startAfter).get();
            query = query.startAfter(startDoc);
        }

        const snapshot = await query.get();

        return snapshot.docs.map(doc => {
            const userData = doc.data();
            return {
                id: doc.id,
                ...userData,
                tokens: userData.tokens ? decryptTokens(userData.tokens) : null
            };
        });
    } catch (error) {
        console.error('Error getting active users:', error);
        throw new Error('Failed to get active users');
    }
};

/**
 * Search users by name or email
 * @param {string} searchTerm - Search term
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of matching users
 */
export const searchUsers = async (searchTerm, limit = 20) => {
    try {
        // Note: Firebase doesn't support full-text search natively
        // This is a simple implementation that searches by email prefix
        // For production, consider using Algolia or similar service

        const snapshot = await db.collection(USERS_COLLECTION)
            .where('isDeleted', '==', false)
            .where('isActive', '==', true)
            .where('email', '>=', searchTerm)
            .where('email', '<=', searchTerm + '\uf8ff')
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => {
            const userData = doc.data();
            return {
                id: doc.id,
                ...userData,
                tokens: userData.tokens ? decryptTokens(userData.tokens) : null
            };
        });
    } catch (error) {
        console.error('Error searching users:', error);
        throw new Error('Failed to search users');
    }
};
