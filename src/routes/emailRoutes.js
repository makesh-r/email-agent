import express from 'express';
import { handleGmailWebhook } from '../controllers/emailController.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /email/webhook
 * @desc    Handle Gmail webhook notifications
 * @access  Public (Gmail sends webhooks)
 */
router.post('/webhook', handleGmailWebhook);

/**
 * @route   GET /email/profile
 * @desc    Get user's Gmail profile information
 * @access  Private
 */
router.get('/profile', requireAuth, (req, res) => {
    // This endpoint would use the authenticated user's tokens
    // to fetch Gmail profile information
    res.json({
        success: true,
        message: 'Profile endpoint - requires authentication',
        user: req.user
    });
});

/**
 * @route   GET /email/messages
 * @desc    Get user's email messages
 * @access  Private
 */
router.get('/messages', requireAuth, (req, res) => {
    // This endpoint would use the authenticated user's tokens
    // to fetch email messages
    res.json({
        success: true,
        message: 'Messages endpoint - requires authentication',
        user: req.user
    });
});

/**
 * @route   POST /email/send
 * @desc    Send an email
 * @access  Private
 */
router.post('/send', requireAuth, (req, res) => {
    // This endpoint would use the authenticated user's tokens
    // to send emails
    res.json({
        success: true,
        message: 'Send email endpoint - requires authentication',
        user: req.user
    });
});

export default router;