// Vercel serverless function for deleting home team player by ID
const { query } = require('../../../../database/db');
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
                // Get player ID from URL - Vercel passes it in req.query or we extract from URL
                let playerId = req.query?.id;
                
                // If not in query, try to extract from URL
                if (!playerId) {
                    const urlParts = (req.url || '').split('/');
                    playerId = urlParts[urlParts.length - 1];
                }

                if (!playerId || isNaN(playerId)) {
                    return res.status(400).json({ error: 'Invalid player ID' });
                }

                // Verify player belongs to user's home team
                const verifyResult = await query(
                    `SELECT htp.id FROM home_team_players htp
                     JOIN home_teams ht ON htp.home_team_id = ht.id
                     WHERE htp.id = $1 AND ht.user_id = $2`,
                    [parseInt(playerId), userId]
                );

                if (verifyResult.rows.length === 0) {
                    return res.status(404).json({ error: 'Player not found' });
                }

                await query('DELETE FROM home_team_players WHERE id = $1', [parseInt(playerId)]);
                return res.json({ message: 'Player deleted' });
            } else {
                return res.status(405).json({ error: 'Method not allowed' });
            }
        } catch (error) {
            console.error('Delete home team player error:', error);
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};



