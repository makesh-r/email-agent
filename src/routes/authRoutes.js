import express from 'express';
import {
    getAuthUrl,
    handleCallback,
    checkAuthStatus,
    logout,
} from '../controllers/authController.js';

const router = express.Router();

/**
 * @route   GET /auth/url
 * @desc    Generate OAuth2 authorization URL
 * @access  Public
 */
router.get('/url', getAuthUrl);

/**
 * @route   GET /auth/callback
 * @desc    Handle OAuth2 callback from Google
 * @access  Public
 */
router.post('/callback', handleCallback);

/**
 * @route   GET /auth/status
 * @desc    Check authentication status
 * @access  Public
 */
router.get('/status', checkAuthStatus);

/**
 * @route   POST /auth/logout
 * @desc    Logout user and clear session
 * @access  Public
 */
router.post('/logout', logout);

export default router;
