// Vercel serverless function for deleting away team player
// Handles DELETE /api/v2/away-teams/:id/players/:playerId
const { query } = require('../../../../../database/db');
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
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
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

            if (req.method === 'DELETE') {
                // Get IDs from Vercel query params
                const teamId = req.query?.id;
                const playerId = req.query?.playerId;

                if (!teamId || !playerId || isNaN(teamId) || isNaN(playerId)) {
                    return res.status(400).json({ error: 'Invalid team ID or player ID' });
                }

                // Verify player belongs to user's away team
                const verifyResult = await query(
                    `SELECT atp.id FROM away_team_players atp
                     JOIN away_teams at ON atp.away_team_id = at.id
                     WHERE atp.id = $1 AND at.id = $2 AND at.user_id = $3`,
                    [parseInt(playerId), parseInt(teamId), userId]
                );

                if (verifyResult.rows.length === 0) {
                    return res.status(404).json({ error: 'Player not found' });
                }

                await query('DELETE FROM away_team_players WHERE id = $1', [parseInt(playerId)]);
                return res.json({ message: 'Player deleted' });
            } else {
                return res.status(405).json({ error: 'Method not allowed' });
            }
        } catch (error) {
            console.error('Delete away team player error:', error);
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};

