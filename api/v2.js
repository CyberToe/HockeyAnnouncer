// V2 API endpoints for teams, games, and goals
const express = require('express');
const { query } = require('../database/db');
const { authenticateToken } = require('./auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ========== HOME TEAM ROUTES ==========

// Get or create home team
router.get('/home-team', async (req, res) => {
    try {
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
            return res.json(createResult.rows[0]);
        }

        const homeTeam = result.rows[0];
        
        // Get players
        const playersResult = await query(
            'SELECT * FROM home_team_players WHERE home_team_id = $1 ORDER BY player_number',
            [homeTeam.id]
        );
        homeTeam.players = playersResult.rows;

        res.json(homeTeam);
    } catch (error) {
        console.error('Get home team error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update home team
router.put('/home-team', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { team_name, team_color } = req.body;

        const result = await query(
            'UPDATE home_teams SET team_name = $1, team_color = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3 RETURNING *',
            [team_name, team_color, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Home team not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update home team error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add home team player
router.post('/home-team/players', async (req, res) => {
    try {
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

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({ error: 'Player number already exists' });
        }
        console.error('Add home team player error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete home team player
router.delete('/home-team/players/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const playerId = req.params.id;

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
        res.json({ message: 'Player deleted' });
    } catch (error) {
        console.error('Delete home team player error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========== AWAY TEAMS ROUTES ==========

// Get all away teams
router.get('/away-teams', async (req, res) => {
    try {
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

        res.json(teams);
    } catch (error) {
        console.error('Get away teams error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create away team
router.post('/away-teams', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { team_name, team_color } = req.body;

        const result = await query(
            'INSERT INTO away_teams (user_id, team_name, team_color) VALUES ($1, $2, $3) RETURNING *',
            [userId, team_name, team_color || '#4ecdc4']
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
            return res.status(400).json({ error: 'Team name already exists' });
        }
        console.error('Create away team error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update away team
router.put('/away-teams/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const teamId = req.params.id;
        const { team_name, team_color } = req.body;

        const result = await query(
            'UPDATE away_teams SET team_name = $1, team_color = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND user_id = $4 RETURNING *',
            [team_name, team_color, teamId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Away team not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update away team error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete away team
router.delete('/away-teams/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const teamId = req.params.id;

        const result = await query(
            'DELETE FROM away_teams WHERE id = $1 AND user_id = $2 RETURNING id',
            [teamId, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Away team not found' });
        }

        res.json({ message: 'Away team deleted' });
    } catch (error) {
        console.error('Delete away team error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add away team player
router.post('/away-teams/:teamId/players', async (req, res) => {
    try {
        const userId = req.user.userId;
        const teamId = req.params.teamId;
        const { player_name, player_number } = req.body;

        // Verify team belongs to user
        const verifyResult = await query(
            'SELECT id FROM away_teams WHERE id = $1 AND user_id = $2',
            [teamId, userId]
        );

        if (verifyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Away team not found' });
        }

        const result = await query(
            'INSERT INTO away_team_players (away_team_id, player_name, player_number) VALUES ($1, $2, $3) RETURNING *',
            [teamId, player_name, player_number]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: 'Player number already exists' });
        }
        console.error('Add away team player error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete away team player
router.delete('/away-teams/:teamId/players/:playerId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { teamId, playerId } = req.params;

        // Verify player belongs to user's away team
        const verifyResult = await query(
            `SELECT atp.id FROM away_team_players atp
             JOIN away_teams at ON atp.away_team_id = at.id
             WHERE atp.id = $1 AND at.id = $2 AND at.user_id = $3`,
            [playerId, teamId, userId]
        );

        if (verifyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Player not found' });
        }

        await query('DELETE FROM away_team_players WHERE id = $1', [playerId]);
        res.json({ message: 'Player deleted' });
    } catch (error) {
        console.error('Delete away team player error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========== GAMES ROUTES ==========

// Get all games
router.get('/games', async (req, res) => {
    try {
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

        res.json(games);
    } catch (error) {
        console.error('Get games error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create game
router.post('/games', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { game_name, away_team_id, attending_home_player_ids } = req.body;

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
            [userId, game_name, away_team_id]
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

        res.status(201).json(game);
    } catch (error) {
        console.error('Create game error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single game with all details
router.get('/games/:id', async (req, res) => {
    try {
        const userId = req.user.userId;
        const gameId = req.params.id;

        const gameResult = await query(
            `SELECT g.*, at.team_name as away_team_name, at.team_color as away_team_color, at.id as away_team_id
             FROM games g
             JOIN away_teams at ON g.away_team_id = at.id
             WHERE g.id = $1 AND g.user_id = $2`,
            [gameId, userId]
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
            [gameId]
        );
        game.attending_home_players = playersResult.rows;

        // Get goals
        const goalsResult = await query(
            'SELECT * FROM goals WHERE game_id = $1 ORDER BY created_at',
            [gameId]
        );
        game.goals = goalsResult.rows;

        res.json(game);
    } catch (error) {
        console.error('Get game error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ========== GOALS ROUTES ==========

// Record goal
router.post('/games/:gameId/goals', async (req, res) => {
    try {
        const userId = req.user.userId;
        const gameId = req.params.gameId;
        const { scoring_team, scorer_player_id, scorer_is_home, assist1_player_id, assist1_is_home, assist2_player_id, assist2_is_home, period, time_remaining, announcement_text } = req.body;

        // Verify game belongs to user
        const gameResult = await query(
            'SELECT id FROM games WHERE id = $1 AND user_id = $2',
            [gameId, userId]
        );

        if (gameResult.rows.length === 0) {
            return res.status(404).json({ error: 'Game not found' });
        }

        const result = await query(
            `INSERT INTO goals (game_id, scoring_team, scorer_player_id, scorer_is_home, 
             assist1_player_id, assist1_is_home, assist2_player_id, assist2_is_home, 
             period, time_remaining, announcement_text)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [gameId, scoring_team, scorer_player_id, scorer_is_home, assist1_player_id, assist1_is_home, assist2_player_id, assist2_is_home, period, time_remaining, announcement_text]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Record goal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete goal
router.delete('/games/:gameId/goals/:goalId', async (req, res) => {
    try {
        const userId = req.user.userId;
        const { gameId, goalId } = req.params;

        // Verify goal belongs to user's game
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

module.exports = router;



