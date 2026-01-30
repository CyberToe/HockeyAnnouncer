// Vercel serverless function for away team players
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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
            let teamId = req.query?.teamId;
            if (!teamId) {
                // Extract from URL path like /api/v2/away-teams/123/players
                const urlParts = (req.url || '').split('/');
                const teamIdIndex = urlParts.indexOf('away-teams');
                if (teamIdIndex !== -1 && teamIdIndex + 1 < urlParts.length) {
                    teamId = urlParts[teamIdIndex + 1];
                }
            }

            if (!teamId || isNaN(teamId)) {
                return res.status(400).json({ error: 'Invalid team ID' });
            }

            if (method === 'POST') {
                // Add away team player
                const { player_name, player_number } = req.body;

                if (!player_name || !player_number) {
                    return res.status(400).json({ error: 'Player name and number are required' });
                }

                if (player_number < 1 || player_number > 99) {
                    return res.status(400).json({ error: 'Player number must be between 1 and 99' });
                }

                // Verify team belongs to user
                const verifyResult = await query(
                    'SELECT id FROM away_teams WHERE id = $1 AND user_id = $2',
                    [parseInt(teamId), userId]
                );

                if (verifyResult.rows.length === 0) {
                    return res.status(404).json({ error: 'Away team not found' });
                }

                try {
                    const result = await query(
                        'INSERT INTO away_team_players (away_team_id, player_name, player_number) VALUES ($1, $2, $3) RETURNING *',
                        [parseInt(teamId), player_name, parseInt(player_number)]
                    );

                    return res.status(201).json(result.rows[0]);
                } catch (dbError) {
                    if (dbError.code === '23505') {
                        return res.status(400).json({ error: 'Player number already exists' });
                    }
                    throw dbError;
                }
            } else {
                return res.status(405).json({ error: 'Method not allowed' });
            }
        } catch (error) {
            console.error('Away team players error:', error);
            if (error.code === '23505') {
                return res.status(400).json({ error: 'Duplicate entry' });
            }
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};

