// Vercel: DELETE /api/v2/teams/players/:id
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
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
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
            if (req.method !== 'DELETE') {
                return res.status(405).json({ error: 'Method not allowed' });
            }
            let playerId = req.query?.id;
            if (!playerId) {
                const urlParts = (req.url || '').split('/');
                playerId = urlParts[urlParts.length - 1].split('?')[0];
            }
            if (!playerId || isNaN(playerId)) {
                return res.status(400).json({ error: 'Invalid player ID' });
            }
            const verifyResult = await query(
                `SELECT tp.id FROM team_players tp
                 JOIN teams t ON tp.team_id = t.id
                 WHERE tp.id = $1 AND t.user_id = $2`,
                [parseInt(playerId, 10), userId]
            );
            if (verifyResult.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
            await query('DELETE FROM team_players WHERE id = $1', [parseInt(playerId, 10)]);
            return res.json({ message: 'Player deleted' });
        } catch (error) {
            console.error('Delete team player error:', error);
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};
