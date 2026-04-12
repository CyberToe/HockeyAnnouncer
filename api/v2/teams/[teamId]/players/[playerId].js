// Vercel: DELETE / PUT /api/v2/teams/:teamId/players/:playerId
const { query } = require('../../../../../database/db');
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });
    jwt.verify(token, process.env.HA_JWT_SECRET || 'default-secret-change-in-production', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    if (!process.env.HA_DATABASE_URL) {
        return res.status(500).json({ error: 'Server configuration error: Database connection not configured' });
    }

    if (req.method === 'PUT' && typeof req.body === 'string') {
        try {
            req.body = JSON.parse(req.body);
        } catch (e) {
            req.body = {};
        }
    }

    const teamId = parseInt(req.query.teamId, 10);
    const playerId = parseInt(req.query.playerId, 10);
    if (!teamId || !playerId) {
        return res.status(400).json({ error: 'Invalid team or player ID' });
    }

    authenticateToken(req, res, async () => {
        try {
            const userId = req.user.userId;

            const verifyResult = await query(
                `SELECT tp.id FROM team_players tp
                 JOIN teams t ON tp.team_id = t.id
                 WHERE tp.id = $1 AND t.id = $2 AND t.user_id = $3`,
                [playerId, teamId, userId]
            );
            if (verifyResult.rows.length === 0) {
                return res.status(404).json({ error: 'Player not found' });
            }

            if (req.method === 'DELETE') {
                await query('DELETE FROM team_players WHERE id = $1', [playerId]);
                return res.json({ message: 'Player deleted' });
            }

            if (req.method === 'PUT') {
                const { player_number } = req.body || {};
                if (player_number === undefined || player_number === null) {
                    return res.status(400).json({ error: 'Player number is required' });
                }
                try {
                    const result = await query(
                        'UPDATE team_players SET player_number = $1 WHERE id = $2 RETURNING *',
                        [parseInt(player_number, 10), playerId]
                    );
                    return res.json(result.rows[0]);
                } catch (dbError) {
                    if (dbError.code === '23505') {
                        return res.status(400).json({ error: 'Player number already exists' });
                    }
                    throw dbError;
                }
            }

            return res.status(405).json({ error: 'Method not allowed' });
        } catch (error) {
            console.error('Team player route error:', error);
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};
