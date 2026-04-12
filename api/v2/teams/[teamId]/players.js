// Vercel: POST /api/v2/teams/:teamId/players — add roster player
const { query } = require('../../../../database/db');
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

    if ((req.method === 'POST' || req.method === 'PUT') && typeof req.body === 'string') {
        try {
            req.body = JSON.parse(req.body);
        } catch (e) {
            req.body = {};
        }
    }

    const teamId = parseInt(req.query.teamId, 10);
    if (!teamId) {
        return res.status(400).json({ error: 'Invalid team ID' });
    }

    authenticateToken(req, res, async () => {
        try {
            const userId = req.user.userId;
            if (req.method !== 'POST') {
                return res.status(405).json({ error: 'Method not allowed' });
            }

            const { player_name, player_number } = req.body || {};
            if (!player_name || player_number === undefined || player_number === null) {
                return res.status(400).json({ error: 'Player name and number are required' });
            }
            const num = parseInt(player_number, 10);
            if (num < 1 || num > 99) {
                return res.status(400).json({ error: 'Player number must be between 1 and 99' });
            }

            const verifyResult = await query('SELECT id FROM teams WHERE id = $1 AND user_id = $2', [teamId, userId]);
            if (verifyResult.rows.length === 0) {
                return res.status(404).json({ error: 'Team not found' });
            }

            const result = await query(
                'INSERT INTO team_players (team_id, player_name, player_number) VALUES ($1, $2, $3) RETURNING *',
                [teamId, String(player_name).trim(), num]
            );
            return res.status(201).json(result.rows[0]);
        } catch (error) {
            if (error.code === '23505') {
                return res.status(400).json({ error: 'Player number already exists' });
            }
            console.error('Add team player error:', error);
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};
