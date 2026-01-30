// Vercel serverless function for home team players
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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

            if (method === 'POST') {
                // Add home team player
                const { player_name, player_number } = req.body;

                if (!player_name || !player_number) {
                    return res.status(400).json({ error: 'Player name and number are required' });
                }

                if (player_number < 1 || player_number > 99) {
                    return res.status(400).json({ error: 'Player number must be between 1 and 99' });
                }

                // Get home team
                const teamResult = await query('SELECT id FROM home_teams WHERE user_id = $1', [userId]);
                if (teamResult.rows.length === 0) {
                    return res.status(404).json({ error: 'Home team not found' });
                }

                const homeTeamId = teamResult.rows[0].id;

                try {
                    const result = await query(
                        'INSERT INTO home_team_players (home_team_id, player_name, player_number) VALUES ($1, $2, $3) RETURNING *',
                        [homeTeamId, player_name, parseInt(player_number)]
                    );

                    return res.status(201).json(result.rows[0]);
                } catch (dbError) {
                    if (dbError.code === '23505') { // Unique constraint violation
                        return res.status(400).json({ error: 'Player number already exists' });
                    }
                    throw dbError;
                }
            } else if (method === 'GET') {
                // Get all players for home team
                const teamResult = await query('SELECT id FROM home_teams WHERE user_id = $1', [userId]);
                if (teamResult.rows.length === 0) {
                    return res.json([]);
                }

                const homeTeamId = teamResult.rows[0].id;
                const playersResult = await query(
                    'SELECT * FROM home_team_players WHERE home_team_id = $1 ORDER BY player_number',
                    [homeTeamId]
                );

                return res.json(playersResult.rows);
            } else {
                return res.status(405).json({ error: 'Method not allowed' });
            }
        } catch (error) {
            console.error('Home team players error:', error);
            if (error.code === '23505') {
                return res.status(400).json({ error: 'Duplicate entry' });
            }
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};

