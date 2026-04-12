-- Hockey Goal Announcer V2 Database Schema
-- Neon PostgreSQL Database
-- Teams model: multiple teams per user; each game references two teams (team_a, team_b).

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_name VARCHAR(255) NOT NULL,
    team_color VARCHAR(7) DEFAULT '#4ecdc4',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, team_name)
);

CREATE TABLE IF NOT EXISTS team_players (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_name VARCHAR(255) NOT NULL,
    player_number INTEGER NOT NULL CHECK (player_number >= 1 AND player_number <= 99),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, player_number)
);

CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_name VARCHAR(255),
    team_a_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    team_b_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (team_a_id <> team_b_id)
);

CREATE TABLE IF NOT EXISTS game_attending_players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    team_player_id INTEGER NOT NULL REFERENCES team_players(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, team_player_id)
);

CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    scoring_team VARCHAR(10) NOT NULL CHECK (scoring_team IN ('team_a', 'team_b')),
    scorer_player_id INTEGER,
    scorer_is_team_a BOOLEAN NOT NULL,
    assist1_player_id INTEGER,
    assist1_is_team_a BOOLEAN,
    assist2_player_id INTEGER,
    assist2_is_team_a BOOLEAN,
    period VARCHAR(10) NOT NULL CHECK (period IN ('1', '2', '3', 'ot')),
    time_remaining VARCHAR(10) NOT NULL,
    announcement_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id);
CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_game_id ON goals(game_id);
