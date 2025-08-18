/**
 * Authentication middleware to protect routes
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireAuth = (req, res, next) => {
    try {
        // Check if user is authenticated
        if (!req.session.isAuthenticated) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'Please authenticate to access this resource'
            });
        }

        // Check if tokens exist
        if (!req.session.tokens || !req.session.tokens.access_token) {
            return res.status(401).json({
                success: false,
                error: 'Invalid session',
                message: 'Session tokens not found. Please re-authenticate.'
            });
        }

        // Check if access token is expired
        const now = Date.now();
        const tokenExpiry = req.session.tokens.expiry_date;

        if (tokenExpiry && now >= tokenExpiry) {
            return res.status(401).json({
                success: false,
                error: 'Token expired',
                message: 'Access token has expired. Please refresh your token.'
            });
        }

        // Add user info to request object
        req.user = {
            isAuthenticated: true,
            tokens: req.session.tokens
        };

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication check failed'
        });
    }
};

/**
 * Optional authentication middleware
 * Adds user info to request if authenticated, but doesn't require it
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const optionalAuth = (req, res, next) => {
    try {
        if (req.session.isAuthenticated && req.session.tokens) {
            req.user = {
                isAuthenticated: true,
                tokens: req.session.tokens
            };
        } else {
            req.user = {
                isAuthenticated: false,
                tokens: null
            };
        }

        next();
    } catch (error) {
        console.error('Optional auth middleware error:', error);
        req.user = {
            isAuthenticated: false,
            tokens: null
        };
        next();
    }
}; 