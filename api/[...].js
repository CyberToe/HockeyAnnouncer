// Vercel catch-all serverless function for Express routes
// This handles all /api/* routes except those with specific functions (like /api/tts)
const app = require('../server');

// Vercel serverless function handler
module.exports = async (req, res) => {
    // Don't handle /api/tts - it has its own serverless function
    if (req.url && req.url.includes('/tts')) {
        return res.status(404).json({ error: 'Use /api/tts endpoint' });
    }
    
    // Remove /api prefix for Express routing
    // The catch-all pattern means Vercel routes /api/* to this function
    const originalUrl = req.url;
    if (req.url && req.url.startsWith('/api')) {
        req.url = req.url.replace(/^\/api/, '') || '/';
    }
    
    // Handle the request with Express
    return new Promise((resolve) => {
        app(req, res, () => {
            if (!res.headersSent) {
                res.status(404).json({ error: 'Not found' });
            }
            resolve();
        });
    });
};

