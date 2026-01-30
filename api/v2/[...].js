// Vercel catch-all serverless function for V2 API routes
// This handles all /api/v2/* routes
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

// Extract the route from the URL
function getRoute(req) {
    // Vercel catch-all pattern: /api/v2/[...].js
    // req.url will be something like: /api/v2/home-team or /home-team
    // We need to handle both cases
    let url = req.url || '';
    
    // Remove query string if present
    url = url.split('?')[0];
    
    // If it starts with /api/v2/, extract the rest
    if (url.startsWith('/api/v2/')) {
        return url.replace('/api/v2/', '');
    }
    // If it starts with /v2/, extract the rest
    if (url.startsWith('/v2/')) {
        return url.replace('/v2/', '');
    }
    // If it starts with /, it's already the route
    if (url.startsWith('/')) {
        return url.substring(1);
    }
    
    return url;
}

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

        // Authenticate (except for health checks)
        authenticateToken(req, res, async () => {
            try {
                const route = getRoute(req);
                const method = req.method;
                
                console.log('V2 API Request:', { url: req.url, route, method });

            // Route: /api/v2/home-team
            if (route === 'home-team') {
                if (method === 'GET') {
                    // Get or create home team
                    const userId = req.user.userId;
                    
                    let result = await query(
                        'SELECT * FROM home_teams WHERE user_id = $1',
                        [userId]
                    );

                    if (result.rows.length === 0) {
                        // Create default home team
                        const createResult = await query(
                            'INSERT INTO home_teams (user_id, team_name, team_color) VALUES ($1, $2, $3) RETURNING *',
                            [userId, 'Home Team', '#ff6b6b']
                        );
                        const homeTeam = createResult.rows[0];
                        homeTeam.players = [];
                        return res.json(homeTeam);
                    }

                    const homeTeam = result.rows[0];
                    
                    // Get players
                    const playersResult = await query(
                        'SELECT * FROM home_team_players WHERE home_team_id = $1 ORDER BY player_number',
                        [homeTeam.id]
                    );
                    homeTeam.players = playersResult.rows;

                    return res.json(homeTeam);
                } else if (method === 'PUT') {
                    // Update home team
                    const userId = req.user.userId;
                    const { team_name, team_color } = req.body;

                    const result = await query(
                        'UPDATE home_teams SET team_name = $1, team_color = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3 RETURNING *',
                        [team_name, team_color, userId]
                    );

                    if (result.rows.length === 0) {
                        return res.status(404).json({ error: 'Home team not found' });
                    }

                    return res.json(result.rows[0]);
                }
            }

            // Route: /api/v2/home-team/players
            if (route.startsWith('home-team/players')) {
                if (method === 'POST') {
                    // Add home team player
                    const userId = req.user.userId;
                    const { player_name, player_number } = req.body;

                    // Get home team
                    const teamResult = await query('SELECT id FROM home_teams WHERE user_id = $1', [userId]);
                    if (teamResult.rows.length === 0) {
                        return res.status(404).json({ error: 'Home team not found' });
                    }

                    const homeTeamId = teamResult.rows[0].id;

                    const result = await query(
                        'INSERT INTO home_team_players (home_team_id, player_name, player_number) VALUES ($1, $2, $3) RETURNING *',
                        [homeTeamId, player_name, player_number]
                    );

                    return res.status(201).json(result.rows[0]);
                } else if (method === 'DELETE') {
                    // Delete home team player
                    const userId = req.user.userId;
                    const playerId = req.url.split('/').pop(); // Get ID from URL

                    // Verify player belongs to user's home team
                    const verifyResult = await query(
                        `SELECT htp.id FROM home_team_players htp
                         JOIN home_teams ht ON htp.home_team_id = ht.id
                         WHERE htp.id = $1 AND ht.user_id = $2`,
                        [playerId, userId]
                    );

                    if (verifyResult.rows.length === 0) {
                        return res.status(404).json({ error: 'Player not found' });
                    }

                    await query('DELETE FROM home_team_players WHERE id = $1', [playerId]);
                    return res.json({ message: 'Player deleted' });
                }
            }

            // If no route matched
            return res.status(404).json({ error: 'Route not found', route, method });
        } catch (error) {
            console.error('V2 API error:', error);
            if (error.code === '23505') { // Unique constraint violation
                return res.status(400).json({ error: 'Duplicate entry' });
            }
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};

