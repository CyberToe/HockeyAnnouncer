// V2 API endpoints for teams, games, and goals
const express = require('express');
const { query } = require('../database/db');
const { authenticateToken } = require('./auth');

const router = express.Router();

router.use(authenticateToken);

async function loadTeamsWithPlayers(userId) {
    const result = await query(
        'SELECT * FROM teams WHERE user_id = $1 ORDER BY team_name',
        [userId]
    );
    const teams = result.rows;
    for (const team of teams) {
        const playersResult = await query(
            'SELECT * FROM team_players WHERE team_id = $1 ORDER BY player_number',
            [team.id]
        );
        team.players = playersResult.rows;
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

    const goalsResult = await query(
        'SELECT * FROM goals WHERE game_id = $1 ORDER BY created_at',
        [gameId]
    );
    game.goals = goalsResult.rows;
}

// ========== TEAMS ==========

router.get('/teams', async (req, res) => {
    try {
        const teams = await loadTeamsWithPlayers(req.user.userId);
        res.json(teams);
    } catch (error) {
        console.error('Get teams error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/teams', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id, _action, team_name, team_color } = req.body || {};

        if (_action === 'update' && id) {
            if (!team_name) {
                return res.status(400).json({ error: 'Team name is required' });
            }
            const result = await query(
                'UPDATE teams SET team_name = $1, team_color = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
                [team_name, team_color || '#4ecdc4', parseInt(id, 10), userId]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Team not found' });
            }
            return res.json(result.rows[0]);
        }

        if (!team_name) {
            return res.status(400).json({ error: 'Team name is required' });
        }
        const result = await query(
            'INSERT INTO teams (user_id, team_name, team_color) VALUES ($1, $2, $3) RETURNING *',
            [userId, team_name, team_color || '#4ecdc4']
        );
        const team = result.rows[0];
        team.players = [];
        res.status(201).json(team);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Team name already exists' });
        }
        console.error('Create team error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/teams/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const teamId = req.params.id;
        const { team_name, team_color } = req.body;

        const result = await query(
            'UPDATE teams SET team_name = $1, team_color = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
            [team_name, team_color, teamId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update team error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/teams/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const teamId = req.params.id;

        const result = await query(
            'DELETE FROM teams WHERE id = $1 AND user_id = $2 RETURNING id',
            [teamId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }
        res.json({ message: 'Team deleted' });
    } catch (error) {
        console.error('Delete team error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/teams/:teamId/players', async (req, res) => {
    try {
        const userId = req.user.userId;
        const teamId = req.params.teamId;
        const { player_name, player_number } = req.body;

        const verifyResult = await query(
            'SELECT id FROM teams WHERE id = $1 AND user_id = $2',
            [teamId, userId]
        );
        if (verifyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Team not found' });
        }

        const result = await query(
            'INSERT INTO team_players (team_id, player_name, player_number) VALUES ($1, $2, $3) RETURNING *',
            [teamId, player_name, player_number]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Player number already exists' });
        }
        console.error('Add team player error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/teams/:teamId/players/:playerId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { teamId, playerId } = req.params;
        const { player_number } = req.body;

        if (player_number === undefined || player_number === null) {
            return res.status(400).json({ error: 'Player number is required' });
        }

        const verifyResult = await query(
            `SELECT tp.id FROM team_players tp
             JOIN teams t ON tp.team_id = t.id
             WHERE tp.id = $1 AND t.id = $2 AND t.user_id = $3`,
            [playerId, teamId, userId]
        );
        if (verifyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        try {
            const result = await query(
                'UPDATE team_players SET player_number = $1 WHERE id = $2 RETURNING *',
                [parseInt(player_number, 10), parseInt(playerId, 10)]
            );
            res.json(result.rows[0]);
        } catch (dbError) {
            if (dbError.code === '23505') {
                return res.status(400).json({ error: 'Player number already exists' });
            }
            throw dbError;
        }
    } catch (error) {
        console.error('Update team player error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/teams/:teamId/players/:playerId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { teamId, playerId } = req.params;

        const verifyResult = await query(
            `SELECT tp.id FROM team_players tp
             JOIN teams t ON tp.team_id = t.id
             WHERE tp.id = $1 AND t.id = $2 AND t.user_id = $3`,
            [playerId, teamId, userId]
        );
        if (verifyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        await query('DELETE FROM team_players WHERE id = $1', [playerId]);
        res.json({ message: 'Player deleted' });
    } catch (error) {
        console.error('Delete team player error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========== GAMES ==========

router.get('/games', async (req, res) => {
    try {
        const userId = req.user.userId;

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
            const playersResult = await query(
                `SELECT tp.* FROM game_attending_players gap
                 JOIN team_players tp ON gap.team_player_id = tp.id
                 WHERE gap.game_id = $1
                 ORDER BY tp.team_id, tp.player_number`,
                [game.id]
            );
            game.attending_players = playersResult.rows;
        }

        res.json(games);
    } catch (error) {
        console.error('Get games error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/games', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { game_name, team_a_id, team_b_id, attending_player_ids } = req.body;

        const a = parseInt(team_a_id, 10);
        const b = parseInt(team_b_id, 10);
        if (!a || !b || a === b) {
            return res.status(400).json({ error: 'Two distinct teams are required' });
        }

        const verify = await query(
            'SELECT id FROM teams WHERE id = ANY($1::int[]) AND user_id = $2',
            [[a, b], userId]
        );
        if (verify.rows.length !== 2) {
            return res.status(404).json({ error: 'One or both teams not found' });
        }

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
        res.status(201).json(full);
    } catch (error) {
        console.error('Create game error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/games/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const gameId = req.params.id;

        const game = await fetchGameRow(userId, gameId);
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        await attachAttendingAndGoals(game, gameId);
        res.json(game);
    } catch (error) {
        console.error('Get game error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/games/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const gameId = parseInt(req.params.id, 10);
        const { _action, attending_player_ids } = req.body || {};

        if (_action !== 'update-attending-players') {
            return res.status(400).json({ error: 'Unsupported action' });
        }

        const gameRow = await fetchGameRow(userId, gameId);
        if (!gameRow) {
            return res.status(404).json({ error: 'Game not found' });
        }

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
        res.json(game);
    } catch (error) {
        console.error('Update attending players error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========== GOALS ==========

router.post('/games/:gameId/goals', async (req, res) => {
    try {
        const userId = req.user.userId;
        const gameId = req.params.gameId;
        const {
            scoring_team,
            scorer_player_id,
            scorer_is_team_a,
            assist1_player_id,
            assist1_is_team_a,
            assist2_player_id,
            assist2_is_team_a,
            period,
            time_remaining,
            announcement_text
        } = req.body;

        const gameResult = await query(
            'SELECT id FROM games WHERE id = $1 AND user_id = $2',
            [gameId, userId]
        );
        if (gameResult.rows.length === 0) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const result = await query(
            `INSERT INTO goals (game_id, scoring_team, scorer_player_id, scorer_is_team_a,
             assist1_player_id, assist1_is_team_a, assist2_player_id, assist2_is_team_a,
             period, time_remaining, announcement_text)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [
                gameId,
                scoring_team,
                scorer_player_id,
                scorer_is_team_a,
                assist1_player_id,
                assist1_is_team_a,
                assist2_player_id,
                assist2_is_team_a,
                period,
                time_remaining,
                announcement_text
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Record goal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/games/:gameId/goals/:goalId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { gameId, goalId } = req.params;

        const verifyResult = await query(
            'SELECT g.id FROM goals g JOIN games gm ON g.game_id = gm.id WHERE g.id = $1 AND g.game_id = $2 AND gm.user_id = $3',
            [goalId, gameId, userId]
        );
        if (verifyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        await query('DELETE FROM goals WHERE id = $1', [goalId]);
        res.json({ message: 'Goal deleted' });
    } catch (error) {
        console.error('Delete goal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/games/:gameId/goals/:goalId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { gameId, goalId } = req.params;
        const { announcement_text } = req.body || {};

        if (!announcement_text) {
            return res.status(400).json({ error: 'Announcement text is required' });
        }

        const verifyResult = await query(
            'SELECT g.id FROM goals g JOIN games gm ON g.game_id = gm.id WHERE g.id = $1 AND g.game_id = $2 AND gm.user_id = $3',
            [goalId, gameId, userId]
        );
        if (verifyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Goal not found' });
        }

        const result = await query(
            'UPDATE goals SET announcement_text = $1 WHERE id = $2 RETURNING *',
            [announcement_text, goalId]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update goal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
