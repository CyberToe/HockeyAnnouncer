// Vercel: POST /api/v2/teams/players — add player requires team in body, or _action update
const { query } = require('../../../database/db');
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    if (!process.env.HA_DATABASE_URL) {
        return res.status(500).json({ error: 'Server configuration error: Database connection not configured' });
    }

    authenticateToken(req, res, async () => {
        try {
            const userId = req.user.userId;
            if (req.method === 'POST') {
                if (req.body && req.body._action === 'update' && req.body.id) {
                    const playerId = parseInt(req.body.id, 10);
                    const { player_number } = req.body;
                    if (player_number === undefined || player_number === null) {
                        return res.status(400).json({ error: 'Player number is required' });
                    }
                    const verifyResult = await query(
                        `SELECT tp.id FROM team_players tp
                         JOIN teams t ON tp.team_id = t.id
                         WHERE tp.id = $1 AND t.user_id = $2`,
                        [playerId, userId]
                    );
                    if (verifyResult.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
                    try {
                        const result = await query(
                            'UPDATE team_players SET player_number = $1 WHERE id = $2 RETURNING *',
                            [parseInt(player_number, 10), playerId]
                        );
                        return res.json(result.rows[0]);
                    } catch (dbError) {
                        if (dbError.code === '23505') return res.status(400).json({ error: 'Player number already exists' });
                        throw dbError;
                    }
                }
                return res.status(400).json({ error: 'Use /teams/:teamId/players to add a player' });
            }
            return res.status(405).json({ error: 'Method not allowed' });
        } catch (error) {
            console.error('Teams players error:', error);
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};
