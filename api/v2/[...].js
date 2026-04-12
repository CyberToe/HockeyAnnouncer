// Vercel catch-all for /api/v2/* — mirrors api/v2.js (teams, games, goals)
const { query } = require('../../database/db');
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
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

function getRoute(req) {
    let url = req.url || '';
    url = url.split('?')[0].replace(/^\/+/, '');
    if (url.startsWith('api/v2/')) url = url.replace('api/v2/', '');
    else if (url.startsWith('v2/')) url = url.replace('v2/', '');
    return url.replace(/\/+$/, '');
}

async function loadTeamsWithPlayers(userId) {
    const result = await query('SELECT * FROM teams WHERE user_id = $1 ORDER BY team_name', [userId]);
    const teams = result.rows;
    for (const team of teams) {
        const pr = await query(
            'SELECT * FROM team_players WHERE team_id = $1 ORDER BY player_number',
            [team.id]
        );
        team.players = pr.rows;
    }
    return teams;
}

async function fetchGameRow(userId, gameId) {
    const gameResult = await query(
        `SELECT g.*,
                ta.team_name AS team_a_name, ta.team_color AS team_a_color,
                tb.team_name AS team_b_name, tb.team_color AS team_b_color
         FROM games g
         JOIN teams ta ON g.team_a_id = ta.id
         JOIN teams tb ON g.team_b_id = tb.id
         WHERE g.id = $1 AND g.user_id = $2`,
        [gameId, userId]
    );
    return gameResult.rows[0] || null;
}

async function attachAttendingAndGoals(game, gameId) {
    const playersResult = await query(
        `SELECT tp.* FROM game_attending_players gap
         JOIN team_players tp ON gap.team_player_id = tp.id
         WHERE gap.game_id = $1
         ORDER BY tp.team_id, tp.player_number`,
        [gameId]
    );
    game.attending_players = playersResult.rows;
    const goalsResult = await query('SELECT * FROM goals WHERE game_id = $1 ORDER BY created_at', [gameId]);
    game.goals = goalsResult.rows;
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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

    const rawUrl = req.url || '';

    // POST teams/players — update number (_action=update)
    const isTeamPlayersUpdate =
        req.method === 'POST' &&
        req.body &&
        req.body._action === 'update' &&
        req.body.id &&
        (rawUrl.includes('teams/players') || rawUrl.includes('api/v2/teams/players'));

    if (isTeamPlayersUpdate) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(401).json({ error: 'Access token required' });
        try {
            const decoded = jwt.verify(token, process.env.HA_JWT_SECRET || 'default-secret-change-in-production');
            const userId = decoded.userId;
            const playerId = parseInt(req.body.id, 10);
            const player_number = req.body.player_number;
            if (player_number === undefined || player_number === null) {
                return res.status(400).json({ error: 'Player number is required' });
            }
            const verifyResult = await query(
                `SELECT tp.id FROM team_players tp
                 JOIN teams t ON tp.team_id = t.id
                 WHERE tp.id = $1 AND t.user_id = $2`,
                [playerId, userId]
            );
            if (verifyResult.rows.length === 0) {
                return res.status(404).json({ error: 'Player not found' });
            }
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
        } catch (err) {
            if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }
            throw err;
        }
    }

    const isPutWorkaround = req.method === 'POST' && req.body && req.body._method === 'PUT';
    const isDeleteWorkaround = req.method === 'POST' && req.body && req.body._method === 'DELETE';
    if (
        (req.method === 'PUT' || req.method === 'DELETE' || isPutWorkaround || isDeleteWorkaround) &&
        rawUrl.includes('/teams/') &&
        !rawUrl.includes('/players')
    ) {
        const match = rawUrl.match(/teams\/(\d+)/);
        if (match) {
            const teamId = match[1];
            const actualMethod = isPutWorkaround ? 'PUT' : isDeleteWorkaround ? 'DELETE' : req.method;
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) return res.status(401).json({ error: 'Access token required' });
            try {
                const decoded = jwt.verify(token, process.env.HA_JWT_SECRET || 'default-secret-change-in-production');
                req.user = decoded;
                if (req.body && req.body._method) delete req.body._method;
                const userId = req.user.userId;

                if (actualMethod === 'PUT' || isPutWorkaround) {
                    const { team_name, team_color } = req.body || {};
                    if (!team_name) return res.status(400).json({ error: 'Team name is required' });
                    const result = await query(
                        'UPDATE teams SET team_name = $1, team_color = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
                        [team_name, team_color || '#4ecdc4', parseInt(teamId, 10), userId]
                    );
                    if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
                    return res.json(result.rows[0]);
                }
                if (actualMethod === 'DELETE' || isDeleteWorkaround) {
                    const result = await query('DELETE FROM teams WHERE id = $1 AND user_id = $2 RETURNING id', [
                        parseInt(teamId, 10),
                        userId
                    ]);
                    if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
                    return res.json({ message: 'Team deleted' });
                }
            } catch (err) {
                if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
                    return res.status(403).json({ error: 'Invalid or expired token' });
                }
                throw err;
            }
        }
    }

    const isGamesRoute = rawUrl.includes('games/') && !rawUrl.includes('goals');
    if (req.method === 'POST' && isGamesRoute) {
        const match = rawUrl.match(/(?:api\/v2\/)?games\/(\d+)/) || rawUrl.match(/games\/(\d+)/);
        if (match && req.body && req.body._action === 'update-attending-players') {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (!token) return res.status(401).json({ error: 'Access token required' });
            try {
                const decoded = jwt.verify(token, process.env.HA_JWT_SECRET || 'default-secret-change-in-production');
                const userId = decoded.userId;
                const gameId = parseInt(match[1], 10);
                const { attending_player_ids } = req.body || {};
                delete req.body._action;

                const gameRow = await fetchGameRow(userId, gameId);
                if (!gameRow) return res.status(404).json({ error: 'Game not found' });

                await query('DELETE FROM game_attending_players WHERE game_id = $1', [gameId]);
                const a = gameRow.team_a_id;
                const b = gameRow.team_b_id;
                const ids = Array.isArray(attending_player_ids) ? attending_player_ids : [];
                for (const pid of ids) {
                    const ok = await query(
                        `SELECT tp.id FROM team_players tp
                         WHERE tp.id = $1 AND (tp.team_id = $2 OR tp.team_id = $3)`,
                        [pid, a, b]
                    );
                    if (ok.rows.length > 0) {
                        await query(
                            'INSERT INTO game_attending_players (game_id, team_player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                            [gameId, pid]
                        );
                    }
                }
                const game = await fetchGameRow(userId, gameId);
                await attachAttendingAndGoals(game, gameId);
                return res.json(game);
            } catch (err) {
                if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
                    return res.status(403).json({ error: 'Invalid or expired token' });
                }
                throw err;
            }
        }
    }

    authenticateToken(req, res, async () => {
        try {
            const route = getRoute(req);
            const method = req.method;
            const userId = req.user.userId;

            // --- /teams ---
            if (route === 'teams') {
                if (method === 'GET') {
                    const teams = await loadTeamsWithPlayers(userId);
                    return res.json(teams);
                }
                if (method === 'POST') {
                    const { id, _action, team_name, team_color } = req.body || {};
                    if (_action === 'update' && id) {
                        if (!team_name) return res.status(400).json({ error: 'Team name is required' });
                        const result = await query(
                            'UPDATE teams SET team_name = $1, team_color = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
                            [team_name, team_color || '#4ecdc4', parseInt(id, 10), userId]
                        );
                        if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
                        return res.json(result.rows[0]);
                    }
                    if (!team_name) return res.status(400).json({ error: 'Team name is required' });
                    try {
                        const result = await query(
                            'INSERT INTO teams (user_id, team_name, team_color) VALUES ($1, $2, $3) RETURNING *',
                            [userId, team_name, team_color || '#4ecdc4']
                        );
                        const team = result.rows[0];
                        team.players = [];
                        return res.status(201).json(team);
                    } catch (dbError) {
                        if (dbError.code === '23505') return res.status(400).json({ error: 'Team name already exists' });
                        throw dbError;
                    }
                }
            }

            if (route.startsWith('teams/')) {
                const parts = route.split('/').filter(Boolean);
                if (parts.length === 2 && parts[0] === 'teams') {
                    const teamId = parts[1];
                    const isPutMethod = method === 'PUT' || (method === 'POST' && req.body && req.body._method === 'PUT');
                    const isDeleteMethod = method === 'DELETE' || (method === 'POST' && req.body && req.body._method === 'DELETE');
                    if (isPutMethod) {
                        if (req.body && req.body._method) delete req.body._method;
                        const { team_name, team_color } = req.body || {};
                        if (!team_name) return res.status(400).json({ error: 'Team name is required' });
                        const result = await query(
                            'UPDATE teams SET team_name = $1, team_color = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
                            [team_name, team_color || '#4ecdc4', parseInt(teamId, 10), userId]
                        );
                        if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
                        return res.json(result.rows[0]);
                    }
                    if (isDeleteMethod) {
                        if (req.body && req.body._method) delete req.body._method;
                        const result = await query('DELETE FROM teams WHERE id = $1 AND user_id = $2 RETURNING id', [
                            parseInt(teamId, 10),
                            userId
                        ]);
                        if (result.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
                        return res.json({ message: 'Team deleted' });
                    }
                } else if (parts.length === 4 && parts[2] === 'players') {
                    const teamId = parts[1];
                    const playerId = parts[3];
                    if (method === 'DELETE') {
                        const verifyResult = await query(
                            `SELECT tp.id FROM team_players tp
                             JOIN teams t ON tp.team_id = t.id
                             WHERE tp.id = $1 AND t.id = $2 AND t.user_id = $3`,
                            [parseInt(playerId, 10), parseInt(teamId, 10), userId]
                        );
                        if (verifyResult.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
                        await query('DELETE FROM team_players WHERE id = $1', [parseInt(playerId, 10)]);
                        return res.json({ message: 'Player deleted' });
                    }
                    if (method === 'PUT') {
                        const { player_number } = req.body || {};
                        if (player_number === undefined) return res.status(400).json({ error: 'Player number is required' });
                        const verifyResult = await query(
                            `SELECT tp.id FROM team_players tp
                             JOIN teams t ON tp.team_id = t.id
                             WHERE tp.id = $1 AND t.id = $2 AND t.user_id = $3`,
                            [parseInt(playerId, 10), parseInt(teamId, 10), userId]
                        );
                        if (verifyResult.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
                        try {
                            const result = await query(
                                'UPDATE team_players SET player_number = $1 WHERE id = $2 RETURNING *',
                                [parseInt(player_number, 10), parseInt(playerId, 10)]
                            );
                            return res.json(result.rows[0]);
                        } catch (dbError) {
                            if (dbError.code === '23505') return res.status(400).json({ error: 'Player number already exists' });
                            throw dbError;
                        }
                    }
                } else if (parts.length === 3 && parts[2] === 'players') {
                    const teamId = parts[1];
                    if (method === 'POST' && (!req.body || !req.body._action)) {
                        const { player_name, player_number } = req.body || {};
                        if (!player_name || !player_number) {
                            return res.status(400).json({ error: 'Player name and number are required' });
                        }
                        const verifyResult = await query('SELECT id FROM teams WHERE id = $1 AND user_id = $2', [
                            parseInt(teamId, 10),
                            userId
                        ]);
                        if (verifyResult.rows.length === 0) return res.status(404).json({ error: 'Team not found' });
                        try {
                            const result = await query(
                                'INSERT INTO team_players (team_id, player_name, player_number) VALUES ($1, $2, $3) RETURNING *',
                                [parseInt(teamId, 10), player_name, parseInt(player_number, 10)]
                            );
                            return res.status(201).json(result.rows[0]);
                        } catch (dbError) {
                            if (dbError.code === '23505') return res.status(400).json({ error: 'Player number already exists' });
                            throw dbError;
                        }
                    }
                }
            }

            // --- /teams/players (POST update handled early) ---

            // --- /games ---
            if (route === 'games') {
                if (method === 'POST' && req.body && req.body._action === 'record-goal' && req.body.game_id) {
                    const gameId = req.body.game_id;
                    const scoringTeam = req.body.scoring_team || req.body.team;
                    const scorerPlayerId = req.body.scorer_player_id || req.body.scorer_id;
                    const assist1PlayerId = req.body.assist1_player_id || req.body.assist1_id;
                    const assist2PlayerId = req.body.assist2_player_id || req.body.assist2_id;
                    const {
                        scorer_is_team_a,
                        assist1_is_team_a,
                        assist2_is_team_a,
                        period,
                        time_remaining,
                        announcement_text
                    } = req.body || {};

                    const gameResult = await query('SELECT id FROM games WHERE id = $1 AND user_id = $2', [
                        parseInt(gameId, 10),
                        userId
                    ]);
                    if (gameResult.rows.length === 0) return res.status(404).json({ error: 'Game not found' });

                    const result = await query(
                        `INSERT INTO goals (game_id, scoring_team, scorer_player_id, scorer_is_team_a,
                         assist1_player_id, assist1_is_team_a, assist2_player_id, assist2_is_team_a,
                         period, time_remaining, announcement_text)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                        [
                            parseInt(gameId, 10),
                            scoringTeam,
                            scorerPlayerId || null,
                            scorer_is_team_a !== undefined ? scorer_is_team_a : true,
                            assist1PlayerId || null,
                            assist1_is_team_a != null ? assist1_is_team_a : null,
                            assist2PlayerId || null,
                            assist2_is_team_a != null ? assist2_is_team_a : null,
                            period || null,
                            time_remaining || null,
                            announcement_text || null
                        ]
                    );
                    return res.status(201).json(result.rows[0]);
                }

                if (method === 'POST' && req.body && req.body._action === 'update-attending-players' && req.body.id) {
                    const gameId = parseInt(req.body.id, 10);
                    delete req.body._action;
                    delete req.body.id;
                    const { attending_player_ids } = req.body || {};

                    const gameRow = await fetchGameRow(userId, gameId);
                    if (!gameRow) return res.status(404).json({ error: 'Game not found' });

                    await query('DELETE FROM game_attending_players WHERE game_id = $1', [gameId]);
                    const a = gameRow.team_a_id;
                    const b = gameRow.team_b_id;
                    const ids = Array.isArray(attending_player_ids) ? attending_player_ids : [];
                    for (const pid of ids) {
                        const ok = await query(
                            `SELECT tp.id FROM team_players tp
                             WHERE tp.id = $1 AND (tp.team_id = $2 OR tp.team_id = $3)`,
                            [pid, a, b]
                        );
                        if (ok.rows.length > 0) {
                            await query(
                                'INSERT INTO game_attending_players (game_id, team_player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                                [gameId, pid]
                            );
                        }
                    }
                    const game = await fetchGameRow(userId, gameId);
                    await attachAttendingAndGoals(game, gameId);
                    return res.json(game);
                }

                if (method === 'POST' && req.body && req.body._action === 'get' && req.body.id) {
                    const gameId = parseInt(req.body.id, 10);
                    const game = await fetchGameRow(userId, gameId);
                    if (!game) return res.status(404).json({ error: 'Game not found' });
                    await attachAttendingAndGoals(game, gameId);
                    return res.json(game);
                }

                if (method === 'POST' && req.body && req.body._action === 'update-goal' && req.body.game_id && req.body.goal_id) {
                    const gameId = parseInt(req.body.game_id, 10);
                    const goalId = parseInt(req.body.goal_id, 10);
                    const { announcement_text } = req.body;
                    const verifyResult = await query(
                        `SELECT g.id FROM goals g
                         JOIN games gm ON g.game_id = gm.id
                         WHERE g.id = $1 AND gm.id = $2 AND gm.user_id = $3`,
                        [goalId, gameId, userId]
                    );
                    if (verifyResult.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
                    const result = await query('UPDATE goals SET announcement_text = $1 WHERE id = $2 RETURNING *', [
                        announcement_text,
                        goalId
                    ]);
                    return res.json(result.rows[0]);
                }

                if (method === 'GET') {
                    const result = await query(
                        `SELECT g.*,
                                ta.team_name AS team_a_name, ta.team_color AS team_a_color,
                                tb.team_name AS team_b_name, tb.team_color AS team_b_color
                         FROM games g
                         JOIN teams ta ON g.team_a_id = ta.id
                         JOIN teams tb ON g.team_b_id = tb.id
                         WHERE g.user_id = $1
                         ORDER BY g.created_at DESC`,
                        [userId]
                    );
                    const games = result.rows;
                    for (const game of games) {
                        const pr = await query(
                            `SELECT tp.* FROM game_attending_players gap
                             JOIN team_players tp ON gap.team_player_id = tp.id
                             WHERE gap.game_id = $1
                             ORDER BY tp.team_id, tp.player_number`,
                            [game.id]
                        );
                        game.attending_players = pr.rows;
                    }
                    return res.json(games);
                }

                if (
                    method === 'POST' &&
                    (!req.body ||
                        !req.body._action ||
                        (req.body._action !== 'get' &&
                            req.body._action !== 'update-attending-players' &&
                            req.body._action !== 'record-goal' &&
                            req.body._action !== 'update-goal'))
                ) {
                    const { game_name, team_a_id, team_b_id, attending_player_ids } = req.body || {};
                    const a = parseInt(team_a_id, 10);
                    const b = parseInt(team_b_id, 10);
                    if (!a || !b || a === b) {
                        return res.status(400).json({ error: 'Two distinct teams are required' });
                    }
                    const verify = await query('SELECT id FROM teams WHERE id = ANY($1::int[]) AND user_id = $2', [
                        [a, b],
                        userId
                    ]);
                    if (verify.rows.length !== 2) return res.status(404).json({ error: 'One or both teams not found' });

                    const gameResult = await query(
                        'INSERT INTO games (user_id, game_name, team_a_id, team_b_id) VALUES ($1, $2, $3, $4) RETURNING *',
                        [userId, game_name || null, a, b]
                    );
                    const game = gameResult.rows[0];

                    let playersToAdd = Array.isArray(attending_player_ids) ? attending_player_ids : [];
                    if (playersToAdd.length === 0) {
                        const allA = await query('SELECT id FROM team_players WHERE team_id = $1', [a]);
                        const allB = await query('SELECT id FROM team_players WHERE team_id = $1', [b]);
                        playersToAdd = [...allA.rows.map((r) => r.id), ...allB.rows.map((r) => r.id)];
                    }
                    for (const pid of playersToAdd) {
                        const ok = await query(
                            `SELECT tp.id FROM team_players tp
                             WHERE tp.id = $1 AND (tp.team_id = $2 OR tp.team_id = $3)`,
                            [pid, a, b]
                        );
                        if (ok.rows.length > 0) {
                            await query(
                                'INSERT INTO game_attending_players (game_id, team_player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                                [game.id, pid]
                            );
                        }
                    }
                    const full = await fetchGameRow(userId, game.id);
                    await attachAttendingAndGoals(full, game.id);
                    return res.status(201).json(full);
                }
            }

            if (route.startsWith('games/')) {
                const parts = route.split('/').filter(Boolean);
                if (parts.length >= 2 && parts[0] === 'games') {
                    const gameId = parts[1];
                    const isGet = method === 'GET' || (method === 'POST' && req.body && req.body._action === 'get');

                    if (isGet && parts.length === 2) {
                        if (req.body && req.body._action) delete req.body._action;
                        const game = await fetchGameRow(userId, parseInt(gameId, 10));
                        if (!game) return res.status(404).json({ error: 'Game not found' });
                        await attachAttendingAndGoals(game, parseInt(gameId, 10));
                        return res.json(game);
                    }

                    if (parts.length === 2 && method === 'POST' && req.body && req.body._action === 'update-attending-players') {
                        delete req.body._action;
                        const { attending_player_ids } = req.body || {};
                        const gid = parseInt(gameId, 10);
                        const gameRow = await fetchGameRow(userId, gid);
                        if (!gameRow) return res.status(404).json({ error: 'Game not found' });
                        await query('DELETE FROM game_attending_players WHERE game_id = $1', [gid]);
                        const a = gameRow.team_a_id;
                        const b = gameRow.team_b_id;
                        const ids = Array.isArray(attending_player_ids) ? attending_player_ids : [];
                        for (const pid of ids) {
                            const ok = await query(
                                `SELECT tp.id FROM team_players tp
                                 WHERE tp.id = $1 AND (tp.team_id = $2 OR tp.team_id = $3)`,
                                [pid, a, b]
                            );
                            if (ok.rows.length > 0) {
                                await query(
                                    'INSERT INTO game_attending_players (game_id, team_player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                                    [gid, pid]
                                );
                            }
                        }
                        const game = await fetchGameRow(userId, gid);
                        await attachAttendingAndGoals(game, gid);
                        return res.json(game);
                    }

                    if (parts.length === 4 && parts[2] === 'goals') {
                        const goalId = parts[3];
                        if (method === 'DELETE') {
                            const verifyResult = await query(
                                `SELECT g.id FROM goals g
                                 JOIN games gm ON g.game_id = gm.id
                                 WHERE g.id = $1 AND gm.id = $2 AND gm.user_id = $3`,
                                [parseInt(goalId, 10), parseInt(gameId, 10), userId]
                            );
                            if (verifyResult.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
                            await query('DELETE FROM goals WHERE id = $1', [parseInt(goalId, 10)]);
                            return res.json({ message: 'Goal deleted' });
                        }
                        if (method === 'PUT' || (method === 'POST' && req.body && req.body._method === 'PUT')) {
                            if (req.body && req.body._method) delete req.body._method;
                            const { announcement_text } = req.body || {};
                            if (!announcement_text) return res.status(400).json({ error: 'Announcement text is required' });
                            const verifyResult = await query(
                                `SELECT g.id FROM goals g
                                 JOIN games gm ON g.game_id = gm.id
                                 WHERE g.id = $1 AND gm.id = $2 AND gm.user_id = $3`,
                                [parseInt(goalId, 10), parseInt(gameId, 10), userId]
                            );
                            if (verifyResult.rows.length === 0) return res.status(404).json({ error: 'Goal not found' });
                            const result = await query('UPDATE goals SET announcement_text = $1 WHERE id = $2 RETURNING *', [
                                announcement_text,
                                parseInt(goalId, 10)
                            ]);
                            return res.json(result.rows[0]);
                        }
                    }

                    if (parts.length === 3 && parts[2] === 'goals' && method === 'POST') {
                        const scoringTeam = req.body.scoring_team || req.body.team;
                        const scorerPlayerId = req.body.scorer_player_id || req.body.scorer_id;
                        const assist1PlayerId = req.body.assist1_player_id || req.body.assist1_id;
                        const assist2PlayerId = req.body.assist2_player_id || req.body.assist2_id;
                        const {
                            scorer_is_team_a,
                            assist1_is_team_a,
                            assist2_is_team_a,
                            period,
                            time_remaining,
                            announcement_text
                        } = req.body || {};

                        const gameResult = await query('SELECT id FROM games WHERE id = $1 AND user_id = $2', [
                            parseInt(gameId, 10),
                            userId
                        ]);
                        if (gameResult.rows.length === 0) return res.status(404).json({ error: 'Game not found' });

                        const result = await query(
                            `INSERT INTO goals (game_id, scoring_team, scorer_player_id, scorer_is_team_a,
                             assist1_player_id, assist1_is_team_a, assist2_player_id, assist2_is_team_a,
                             period, time_remaining, announcement_text)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
                            [
                                parseInt(gameId, 10),
                                scoringTeam,
                                scorerPlayerId || null,
                                scorer_is_team_a !== undefined ? scorer_is_team_a : true,
                                assist1PlayerId || null,
                                assist1_is_team_a != null ? assist1_is_team_a : null,
                                assist2PlayerId || null,
                                assist2_is_team_a != null ? assist2_is_team_a : null,
                                period || null,
                                time_remaining || null,
                                announcement_text || null
                            ]
                        );
                        return res.status(201).json(result.rows[0]);
                    }
                }
            }

            if (route === 'test' || route === '') {
                return res.json({ message: 'V2 catch-all is working', route, method, url: req.url });
            }

            return res.status(404).json({
                error: 'Route not found',
                route,
                method,
                url: req.url
            });
        } catch (error) {
            console.error('V2 API error:', error);
            if (error.code === '23505') return res.status(400).json({ error: 'Duplicate entry' });
            return res.status(500).json({ error: 'Internal server error', details: error.message });
        }
    });
};
