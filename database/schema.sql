-- Hockey Goal Announcer V2 Database Schema
-- Neon PostgreSQL Database

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Home team (one per user)
CREATE TABLE IF NOT EXISTS home_teams (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_name VARCHAR(255) NOT NULL,
    team_color VARCHAR(7) DEFAULT '#ff6b6b',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Home team players
CREATE TABLE IF NOT EXISTS home_team_players (
    id SERIAL PRIMARY KEY,
    home_team_id INTEGER NOT NULL REFERENCES home_teams(id) ON DELETE CASCADE,
    player_name VARCHAR(255) NOT NULL,
    player_number INTEGER NOT NULL CHECK (player_number >= 1 AND player_number <= 99),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(home_team_id, player_number)
);

-- Away teams (multiple per user)
CREATE TABLE IF NOT EXISTS away_teams (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_name VARCHAR(255) NOT NULL,
    team_color VARCHAR(7) DEFAULT '#4ecdc4',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, team_name)
);

-- Away team players
CREATE TABLE IF NOT EXISTS away_team_players (
    id SERIAL PRIMARY KEY,
    away_team_id INTEGER NOT NULL REFERENCES away_teams(id) ON DELETE CASCADE,
    player_name VARCHAR(255) NOT NULL,
    player_number INTEGER NOT NULL CHECK (player_number >= 1 AND player_number <= 99),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(away_team_id, player_number)
);

-- Games
CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_name VARCHAR(255),
    away_team_id INTEGER NOT NULL REFERENCES away_teams(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game attending home players (many-to-many relationship)
CREATE TABLE IF NOT EXISTS game_home_players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    home_team_player_id INTEGER NOT NULL REFERENCES home_team_players(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, home_team_player_id)
);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    scoring_team VARCHAR(10) NOT NULL CHECK (scoring_team IN ('home', 'away')),
    scorer_player_id INTEGER, -- Can be home_team_player_id or away_team_player_id
    scorer_is_home BOOLEAN NOT NULL, -- true if scorer is from home team
    assist1_player_id INTEGER,
    assist1_is_home BOOLEAN,
    assist2_player_id INTEGER,
    assist2_is_home BOOLEAN,
    period VARCHAR(10) NOT NULL CHECK (period IN ('1', '2', '3', 'ot')),
    time_remaining VARCHAR(10) NOT NULL,
    announcement_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_home_teams_user_id ON home_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_away_teams_user_id ON away_teams(user_id);
CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_game_id ON goals(game_id);


