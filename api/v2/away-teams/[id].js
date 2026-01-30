// Vercel serverless function for away team operations
// Handles PUT /api/v2/away-teams/:id and DELETE /api/v2/away-teams/:id
const { query } = require('../../../database/db');
const jwt = require('jsonwebtoken');

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.HA_JWT_SECRET || 'default-secret-change-in-production');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
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

    // Parse request body if needed
    if ((req.method === 'PUT') && typeof req.body === 'string') {
        try {
            req.body = JSON.parse(req.body);
        } catch (e) {
            console.error('Error parsing request body:', e);
            req.body = {};
        }
    }

    authenticateToken(req, res, async () => {
        try {
            const userId = req.user.userId;
            const method = req.method;

            // Get team ID from Vercel query params (from [id] in filename)
            const teamId = req.query?.id;

            if (!teamId || isNaN(teamId)) {
                return res.status(400).json({ error: 'Invalid team ID' });
            }

            if (method === 'PUT') {
                // Update away team
                const { team_name, team_color } = req.body || {};

                if (!team_name) {
                    return res.status(400).json({ error: 'Team name is required' });
                }

                console.log('Updating away team:', { teamId, userId, team_name, team_color, body: req.body });

                const result = await query(
                    'UPDATE away_teams SET team_name = $1, team_color = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
                    [team_name, team_color || '#4ecdc4', parseInt(teamId), userId]
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
            console.error('Away team operation error:', error);
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};

