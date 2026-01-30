// Vercel catch-all serverless function for Express routes
// This handles all /api/* routes except those with specific functions (like /api/tts)
const app = require('../server');

// Vercel serverless function handler
module.exports = async (req, res) => {
    // Don't handle /api/tts - it has its own serverless function
    if (req.url && (req.url.includes('/tts') || req.url === '/tts')) {
        return res.status(404).json({ error: 'Use /api/tts endpoint' });
    }
    
    // The catch-all receives the full path including /api
    // Express routes are already mounted at /api/auth and /api/v2
    // So we need to keep the /api prefix in the URL
    
    // Vercel passes the path in req.url, but we need to ensure it's correct
    // The catch-all pattern [...].js receives the path segments
    // For /api/auth/register, req.url will be /api/auth/register
    
    // Handle the request with Express
    return new Promise((resolve) => {
        // Create a proper request handler
        const handler = (err) => {
            if (err) {
                console.error('Express handler error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Internal server error' });
                }
            } else if (!res.headersSent) {
                res.status(404).json({ error: 'Not found', path: req.url });
            }
            resolve();
        };
        
        app(req, res, handler);
    });
};

