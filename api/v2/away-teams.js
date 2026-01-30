// Vercel serverless function for away teams
const { query } = require('../../database/db');
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

            if (method === 'GET') {
                // Get all away teams
                const result = await query(
                    'SELECT * FROM away_teams WHERE user_id = $1 ORDER BY team_name',
                    [userId]
                );

                const teams = result.rows;
                
                // Get players for each team
                for (const team of teams) {
                    const playersResult = await query(
                        'SELECT * FROM away_team_players WHERE away_team_id = $1 ORDER BY player_number',
                        [team.id]
                    );
                    team.players = playersResult.rows;
                }

                return res.json(teams);
            } else if (method === 'POST') {
                // Create away team
                const { team_name, team_color } = req.body;

                if (!team_name) {
                    return res.status(400).json({ error: 'Team name is required' });
                }

                try {
                    const result = await query(
                        'INSERT INTO away_teams (user_id, team_name, team_color) VALUES ($1, $2, $3) RETURNING *',
                        [userId, team_name, team_color || '#4ecdc4']
                    );

                    const team = result.rows[0];
                    team.players = []; // New team has no players yet

                    return res.status(201).json(team);
                } catch (dbError) {
                    if (dbError.code === '23505') { // Unique constraint violation
                        return res.status(400).json({ error: 'Team name already exists' });
                    }
                    throw dbError;
                }
            } else {
                return res.status(405).json({ error: 'Method not allowed' });
            }
        } catch (error) {
            console.error('Away teams error:', error);
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};

