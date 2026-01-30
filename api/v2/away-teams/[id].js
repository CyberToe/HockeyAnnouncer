// Vercel serverless function for away team by ID (update/delete)
const { query } = require('../../../database/db');
const jwt = require('jsonwebtoken');

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.HA_JWT_SECRET || 'default-secret-change-in-production', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Check database connection
    if (!process.env.HA_DATABASE_URL) {
        return res.status(500).json({ 
            error: 'Server configuration error: Database connection not configured'
        });
    }

    authenticateToken(req, res, async () => {
        try {
            const userId = req.user.userId;
            const method = req.method;
            
            // Get team ID from URL
            let teamId = req.query?.id;
            if (!teamId) {
                const urlParts = (req.url || '').split('/');
                teamId = urlParts[urlParts.length - 1];
            }

            if (!teamId || isNaN(teamId)) {
                return res.status(400).json({ error: 'Invalid team ID' });
            }

            if (method === 'PUT') {
                // Update away team
                const { team_name, team_color } = req.body;

                const result = await query(
                    'UPDATE away_teams SET team_name = $1, team_color = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
                    [team_name, team_color, parseInt(teamId), userId]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Away team not found' });
                }

                return res.json(result.rows[0]);
            } else if (method === 'DELETE') {
                // Delete away team
                const result = await query(
                    'DELETE FROM away_teams WHERE id = $1 AND user_id = $2 RETURNING id',
                    [parseInt(teamId), userId]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Away team not found' });
                }

                return res.json({ message: 'Away team deleted' });
            } else {
                return res.status(405).json({ error: 'Method not allowed' });
            }
        } catch (error) {
            console.error('Away team update/delete error:', error);
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};

