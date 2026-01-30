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

    try {
        const decoded = jwt.verify(token, process.env.HA_JWT_SECRET || 'default-secret-change-in-production');
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

// Extract the route from the URL
function getRoute(req) {
    // Vercel catch-all pattern: /api/v2/[...].js
    // For /api/v2/away-teams/1/players, req.url might be:
    // - /api/v2/away-teams/1/players (full path)
    // - /away-teams/1/players (relative to the function)
    // - away-teams/1/players (just the segments)
    let url = req.url || '';
    
    console.log('Raw req.url:', url);
    
    // Remove query string if present
    url = url.split('?')[0];
    
    // Remove leading slashes
    url = url.replace(/^\/+/, '');
    
    // If it starts with api/v2/, remove that prefix
    if (url.startsWith('api/v2/')) {
        url = url.replace('api/v2/', '');
    }
    // If it starts with v2/, remove that prefix
    else if (url.startsWith('v2/')) {
        url = url.replace('v2/', '');
    }
    
    // Remove trailing slashes
    url = url.replace(/\/+$/, '');
    
    console.log('Parsed route:', url);
    
    return url;
}

module.exports = async function handler(req, res) {
    // Log the incoming request for debugging
    console.log('V2 catch-all received request:', {
        method: req.method,
        url: req.url,
        path: req.url,
        query: req.query
    });
    
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
    
    // Vercel serverless functions automatically parse JSON bodies
    // But we need to ensure it's an object
    if ((req.method === 'POST' || req.method === 'PUT') && typeof req.body === 'string') {
        try {
            req.body = JSON.parse(req.body);
        } catch (e) {
            console.error('Error parsing request body:', e);
            req.body = {};
        }
    }
    
    // Log request for debugging
    if (req.method === 'PUT' && req.url && req.url.includes('away-teams')) {
        console.log('PUT away-teams request:', {
            url: req.url,
            body: req.body,
            bodyType: typeof req.body
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
            // Handle both exact match and with ID: home-team/players or home-team/players/123
            if (route === 'home-team/players' || route.startsWith('home-team/players/') || route.startsWith('home-team/players')) {
                if (method === 'POST') {
                    // Add home team player
                    const userId = req.user.userId;
                    const { player_name, player_number } = req.body;

                    if (!player_name || !player_number) {
                        return res.status(400).json({ error: 'Player name and number are required' });
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
                } else if (method === 'DELETE') {
                    // Delete home team player - route will be like home-team/players/123
                    const userId = req.user.userId;
                    const parts = route.split('/');
                    const playerId = parts[parts.length - 1]; // Get ID from last part of route

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
            }

            // ========== AWAY TEAMS ROUTES ==========
            
            // Route: /api/v2/away-teams
            if (route === 'away-teams') {
                if (method === 'GET') {
                    // Get all away teams
                    const userId = req.user.userId;
                    
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
                    const userId = req.user.userId;
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
                        team.players = [];
                        return res.status(201).json(team);
                    } catch (dbError) {
                        if (dbError.code === '23505') {
                            return res.status(400).json({ error: 'Team name already exists' });
                        }
                        throw dbError;
                    }
                }
            }

            // Route: /api/v2/away-teams/:id
            if (route.startsWith('away-teams/')) {
                const parts = route.split('/').filter(p => p); // Filter out empty strings
                console.log('Away-teams route matched:', { route, parts, partsLength: parts.length, method, url: req.url });
                
                if (parts.length === 2 && parts[0] === 'away-teams') {
                    // away-teams/:id (PUT or DELETE)
                    const teamId = parts[1];
                    
                    console.log('Processing away-teams/:id route:', { teamId, method, route, parts });
                    
                    if (method === 'PUT') {
                        const userId = req.user.userId;
                        const { team_name, team_color } = req.body || {};

                        if (!team_name) {
                            return res.status(400).json({ error: 'Team name is required' });
                        }

                        console.log('Updating away team:', { teamId, userId, team_name, team_color, body: req.body });

                        const result = await query(
                            'UPDATE away_teams SET team_name = $1, team_color = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
                            [team_name, team_color || '#4ecdc4', parseInt(teamId), userId]
                        );

                        if (result.rows.length === 0) {
                            return res.status(404).json({ error: 'Away team not found' });
                        }

                        return res.json(result.rows[0]);
                    } else if (method === 'DELETE') {
                        const userId = req.user.userId;

                        const result = await query(
                            'DELETE FROM away_teams WHERE id = $1 AND user_id = $2 RETURNING id',
                            [parseInt(teamId), userId]
                        );

                        if (result.rows.length === 0) {
                            return res.status(404).json({ error: 'Away team not found' });
                        }

                        return res.json({ message: 'Away team deleted' });
                    }
                } else if (parts.length === 4 && parts[2] === 'players') {
                    // away-teams/:id/players/:playerId (DELETE)
                    const teamId = parts[1];
                    const playerId = parts[3];
                    
                    if (method === 'DELETE') {
                        const userId = req.user.userId;

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
                    }
                } else if (parts.length === 3 && parts[2] === 'players') {
                    // away-teams/:id/players (POST)
                    const teamId = parts[1];
                    
                    console.log('Processing away-teams players POST route:', { teamId, method, route, parts, body: req.body });
                    
                    if (method === 'POST') {
                        const userId = req.user.userId;
                        const { player_name, player_number } = req.body || {};

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
                    }
                }
            }

            // ========== GAMES ROUTES ==========
            
            // Route: /api/v2/games
            if (route === 'games') {
                if (method === 'GET') {
                    // Get all games
                    const userId = req.user.userId;
                    
                    const result = await query(
                        `SELECT g.*, at.team_name as away_team_name, at.team_color as away_team_color
                         FROM games g
                         JOIN away_teams at ON g.away_team_id = at.id
                         WHERE g.user_id = $1
                         ORDER BY g.created_at DESC`,
                        [userId]
                    );

                    const games = result.rows;
                    
                    // Get attending home players for each game
                    for (const game of games) {
                        const playersResult = await query(
                            `SELECT htp.* FROM game_home_players ghp
                             JOIN home_team_players htp ON ghp.home_team_player_id = htp.id
                             WHERE ghp.game_id = $1
                             ORDER BY htp.player_number`,
                            [game.id]
                        );
                        game.attending_home_players = playersResult.rows;
                    }

                    return res.json(games);
                } else if (method === 'POST') {
                    // Create game
                    const userId = req.user.userId;
                    const { game_name, away_team_id, attending_home_player_ids } = req.body || {};

                    // Verify away team belongs to user
                    const teamResult = await query(
                        'SELECT id FROM away_teams WHERE id = $1 AND user_id = $2',
                        [away_team_id, userId]
                    );

                    if (teamResult.rows.length === 0) {
                        return res.status(404).json({ error: 'Away team not found' });
                    }

                    // Create game
                    const gameResult = await query(
                        'INSERT INTO games (user_id, game_name, away_team_id) VALUES ($1, $2, $3) RETURNING *',
                        [userId, game_name || null, away_team_id]
                    );

                    const game = gameResult.rows[0];

                    // Add attending home players
                    if (attending_home_player_ids && attending_home_player_ids.length > 0) {
                        for (const playerId of attending_home_player_ids) {
                            // Verify player belongs to user's home team
                            const verifyResult = await query(
                                `SELECT htp.id FROM home_team_players htp
                                 JOIN home_teams ht ON htp.home_team_id = ht.id
                                 WHERE htp.id = $1 AND ht.user_id = $2`,
                                [playerId, userId]
                            );

                            if (verifyResult.rows.length > 0) {
                                await query(
                                    'INSERT INTO game_home_players (game_id, home_team_player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                                    [game.id, playerId]
                                );
                            }
                        }
                    }

                    return res.status(201).json(game);
                }
            }

            // Route: /api/v2/games/:id
            if (route.startsWith('games/')) {
                const parts = route.split('/').filter(p => p);
                if (parts.length === 2 && parts[0] === 'games') {
                    const gameId = parts[1];
                    
                    if (method === 'GET') {
                        // Get single game with all details
                        const userId = req.user.userId;

                        const gameResult = await query(
                            `SELECT g.*, at.team_name as away_team_name, at.team_color as away_team_color, at.id as away_team_id
                             FROM games g
                             JOIN away_teams at ON g.away_team_id = at.id
                             WHERE g.id = $1 AND g.user_id = $2`,
                            [parseInt(gameId), userId]
                        );

                        if (gameResult.rows.length === 0) {
                            return res.status(404).json({ error: 'Game not found' });
                        }

                        const game = gameResult.rows[0];

                        // Get attending home players
                        const playersResult = await query(
                            `SELECT htp.* FROM game_home_players ghp
                             JOIN home_team_players htp ON ghp.home_team_player_id = htp.id
                             WHERE ghp.game_id = $1
                             ORDER BY htp.player_number`,
                            [parseInt(gameId)]
                        );
                        game.attending_home_players = playersResult.rows;

                        // Get goals
                        const goalsResult = await query(
                            'SELECT * FROM goals WHERE game_id = $1 ORDER BY created_at',
                            [parseInt(gameId)]
                        );
                        game.goals = goalsResult.rows;

                        return res.json(game);
                    }
                } else if (parts.length === 4 && parts[0] === 'games' && parts[2] === 'goals') {
                    // Route: /api/v2/games/:id/goals
                    const gameId = parts[1];
                    const goalId = parts[3];
                    
                    if (method === 'DELETE') {
                        // Delete goal
                        const userId = req.user.userId;

                        // Verify goal belongs to user's game
                        const verifyResult = await query(
                            `SELECT g.id FROM goals g
                             JOIN games gm ON g.game_id = gm.id
                             WHERE g.id = $1 AND gm.id = $2 AND gm.user_id = $3`,
                            [parseInt(goalId), parseInt(gameId), userId]
                        );

                        if (verifyResult.rows.length === 0) {
                            return res.status(404).json({ error: 'Goal not found' });
                        }

                        await query('DELETE FROM goals WHERE id = $1', [parseInt(goalId)]);
                        return res.json({ message: 'Goal deleted' });
                    }
                } else if (parts.length === 3 && parts[0] === 'games' && parts[2] === 'goals') {
                    // Route: /api/v2/games/:id/goals (POST)
                    const gameId = parts[1];
                    
                    if (method === 'POST') {
                        // Record goal
                        const userId = req.user.userId;
                        const { team, scorer_id, assist1_id, assist2_id, period, time_remaining } = req.body || {};

                        // Verify game belongs to user
                        const gameResult = await query(
                            'SELECT id FROM games WHERE id = $1 AND user_id = $2',
                            [parseInt(gameId), userId]
                        );

                        if (gameResult.rows.length === 0) {
                            return res.status(404).json({ error: 'Game not found' });
                        }

                        // Insert goal
                        const result = await query(
                            `INSERT INTO goals (game_id, team, scorer_id, assist1_id, assist2_id, period, time_remaining)
                             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                            [parseInt(gameId), team, scorer_id || null, assist1_id || null, assist2_id || null, period || null, time_remaining || null]
                        );

                        return res.status(201).json(result.rows[0]);
                    }
                }
            }

            // Test route to verify catch-all is working
            if (route === 'test' || route === '') {
                return res.json({ 
                    message: 'V2 catch-all is working', 
                    route, 
                    method, 
                    url: req.url,
                    parsedRoute: route
                });
            }

            // If no route matched, return helpful error
            console.error('Route not matched:', { route, method, url: req.url, parts: route.split('/') });
            return res.status(404).json({ 
                error: 'Route not found', 
                route, 
                method,
                url: req.url,
                availableRoutes: ['home-team', 'home-team/players', 'away-teams', 'away-teams/:id', 'away-teams/:id/players', 'games', 'games/:id']
            });
        } catch (error) {
            console.error('V2 API error:', error);
            if (error.code === '23505') { // Unique constraint violation
                return res.status(400).json({ error: 'Duplicate entry' });
            }
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};

