-- =============================================================================
-- Neon PostgreSQL: migrate legacy home/away schema → teams + two-team games
-- =============================================================================
--
-- WHEN TO RUN
--   Run once on a database that still has: home_teams, away_teams, games.away_team_id
--   Do NOT run if games already has team_a_id / team_b_id (already migrated).
--
-- BEFORE YOU RUN
--   1. Branch or backup the Neon database (Neon console → Branch, or pg_dump).
--   2. Run the prerequisite check below in the SQL Editor; it must return 1 row.
--
-- =============================================================================

-- Prerequisite check (must show away_team_id on games):
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'away_team_id';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'team_a_id'
    ) THEN
        RAISE EXCEPTION 'Already migrated: public.games has team_a_id. Do not run this script.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'games' AND column_name = 'away_team_id'
    ) THEN
        RAISE EXCEPTION 'Expected legacy schema: public.games must have column away_team_id.';
    END IF;
END $$;

BEGIN;

-- Detach legacy tables (FK order: children first)
ALTER TABLE IF EXISTS public.goals RENAME TO z_legacy_goals;
ALTER TABLE IF EXISTS public.game_home_players RENAME TO z_legacy_game_home_players;
ALTER TABLE IF EXISTS public.games RENAME TO z_legacy_games;
ALTER TABLE IF EXISTS public.away_team_players RENAME TO z_legacy_away_team_players;
ALTER TABLE IF EXISTS public.away_teams RENAME TO z_legacy_away_teams;
ALTER TABLE IF EXISTS public.home_team_players RENAME TO z_legacy_home_team_players;
ALTER TABLE IF EXISTS public.home_teams RENAME TO z_legacy_home_teams;

-- New core tables (migration columns are removed before COMMIT)
CREATE TABLE public.teams (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    team_name VARCHAR(255) NOT NULL,
    team_color VARCHAR(7) DEFAULT '#4ecdc4',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _m_legacy_home_team_id INTEGER,
    _m_legacy_away_team_id INTEGER,
    UNIQUE (user_id, team_name)
);

CREATE UNIQUE INDEX z_uq_teams_legacy_home ON public.teams (_m_legacy_home_team_id)
WHERE _m_legacy_home_team_id IS NOT NULL;

CREATE UNIQUE INDEX z_uq_teams_legacy_away ON public.teams (_m_legacy_away_team_id)
WHERE _m_legacy_away_team_id IS NOT NULL;

CREATE TABLE public.team_players (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
    player_name VARCHAR(255) NOT NULL,
    player_number INTEGER NOT NULL CHECK (player_number >= 1 AND player_number <= 99),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _m_legacy_home_player_id INTEGER,
    _m_legacy_away_player_id INTEGER,
    UNIQUE (team_id, player_number)
);

CREATE UNIQUE INDEX z_uq_tp_legacy_home ON public.team_players (_m_legacy_home_player_id)
WHERE _m_legacy_home_player_id IS NOT NULL;

CREATE UNIQUE INDEX z_uq_tp_legacy_away ON public.team_players (_m_legacy_away_player_id)
WHERE _m_legacy_away_player_id IS NOT NULL;

CREATE TABLE public.games (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    game_name VARCHAR(255),
    team_a_id INTEGER NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
    team_b_id INTEGER NOT NULL REFERENCES public.teams (id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _m_legacy_game_id INTEGER NOT NULL UNIQUE,
    CHECK (team_a_id <> team_b_id)
);

CREATE TABLE public.game_attending_players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES public.games (id) ON DELETE CASCADE,
    team_player_id INTEGER NOT NULL REFERENCES public.team_players (id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (game_id, team_player_id)
);

CREATE TABLE public.goals (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES public.games (id) ON DELETE CASCADE,
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

-- 1) Away teams → teams
INSERT INTO public.teams (
        user_id,
        team_name,
        team_color,
        created_at,
        updated_at,
        _m_legacy_away_team_id
    )
SELECT user_id,
    team_name,
    team_color,
    created_at,
    updated_at,
    id
FROM public.z_legacy_away_teams;

-- 2) Home teams → teams (suffix if same user+name as an away team)
INSERT INTO public.teams (
        user_id,
        team_name,
        team_color,
        created_at,
        updated_at,
        _m_legacy_home_team_id
    )
SELECT h.user_id,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM public.teams t
            WHERE t.user_id = h.user_id
                AND t.team_name = h.team_name
                AND t._m_legacy_away_team_id IS NOT NULL
        ) THEN h.team_name || ' (home roster)'
        ELSE h.team_name
    END,
    h.team_color,
    h.created_at,
    h.updated_at,
    h.id
FROM public.z_legacy_home_teams h;

-- 3) Away roster → team_players
INSERT INTO public.team_players (
        team_id,
        player_name,
        player_number,
        created_at,
        _m_legacy_away_player_id
    )
SELECT t.id,
    p.player_name,
    p.player_number,
    p.created_at,
    p.id
FROM public.z_legacy_away_team_players p
    JOIN public.teams t ON t._m_legacy_away_team_id = p.away_team_id;

-- 4) Home roster → team_players
INSERT INTO public.team_players (
        team_id,
        player_name,
        player_number,
        created_at,
        _m_legacy_home_player_id
    )
SELECT t.id,
    p.player_name,
    p.player_number,
    p.created_at,
    p.id
FROM public.z_legacy_home_team_players p
    JOIN public.teams t ON t._m_legacy_home_team_id = p.home_team_id;

-- 5) Games: team_a = migrated home team for user, team_b = away team from old FK
INSERT INTO public.games (
        user_id,
        game_name,
        team_a_id,
        team_b_id,
        created_at,
        updated_at,
        _m_legacy_game_id
    )
SELECT g.user_id,
    g.game_name,
    ht.id,
    at.id,
    g.created_at,
    g.updated_at,
    g.id
FROM public.z_legacy_games g
    JOIN public.teams ht ON ht.user_id = g.user_id
    AND ht._m_legacy_home_team_id IS NOT NULL
    JOIN public.teams at ON at._m_legacy_away_team_id = g.away_team_id;

-- 6) Attending players (home roster only in legacy game_home_players)
INSERT INTO public.game_attending_players (game_id, team_player_id)
SELECT ng.id,
    tp.id
FROM public.z_legacy_game_home_players gh
    JOIN public.games ng ON ng._m_legacy_game_id = gh.game_id
    JOIN public.team_players tp ON tp._m_legacy_home_player_id = gh.home_team_player_id;

-- 7) Goals: home → team_a, away → team_b; remap player ids to team_players.id
INSERT INTO public.goals (
        game_id,
        scoring_team,
        scorer_player_id,
        scorer_is_team_a,
        assist1_player_id,
        assist1_is_team_a,
        assist2_player_id,
        assist2_is_team_a,
        period,
        time_remaining,
        announcement_text,
        created_at
    )
SELECT ng.id,
    CASE
        WHEN og.scoring_team = 'home' THEN 'team_a'
        ELSE 'team_b'
    END,
    CASE
        WHEN og.scorer_is_home THEN tph.id
        ELSE tpa.id
    END,
    og.scorer_is_home,
    CASE
        WHEN og.assist1_player_id IS NULL THEN NULL
        WHEN og.assist1_is_home THEN tph_a1.id
        ELSE tpa_a1.id
    END,
    og.assist1_is_home,
    CASE
        WHEN og.assist2_player_id IS NULL THEN NULL
        WHEN og.assist2_is_home THEN tph_a2.id
        ELSE tpa_a2.id
    END,
    og.assist2_is_home,
    og.period,
    og.time_remaining,
    og.announcement_text,
    og.created_at
FROM public.z_legacy_goals og
    JOIN public.games ng ON ng._m_legacy_game_id = og.game_id
    LEFT JOIN public.team_players tph ON tph._m_legacy_home_player_id = og.scorer_player_id
    AND og.scorer_is_home IS TRUE
    LEFT JOIN public.team_players tpa ON tpa._m_legacy_away_player_id = og.scorer_player_id
    AND og.scorer_is_home IS FALSE
    LEFT JOIN public.team_players tph_a1 ON tph_a1._m_legacy_home_player_id = og.assist1_player_id
    AND og.assist1_is_home IS TRUE
    LEFT JOIN public.team_players tpa_a1 ON tpa_a1._m_legacy_away_player_id = og.assist1_player_id
    AND og.assist1_is_home IS FALSE
    LEFT JOIN public.team_players tph_a2 ON tph_a2._m_legacy_home_player_id = og.assist2_player_id
    AND og.assist2_is_home IS TRUE
    LEFT JOIN public.team_players tpa_a2 ON tpa_a2._m_legacy_away_player_id = og.assist2_player_id
    AND og.assist2_is_home IS FALSE;

-- Indexes (match current app schema)
CREATE INDEX IF NOT EXISTS idx_teams_user_id ON public.teams (user_id);
CREATE INDEX IF NOT EXISTS idx_games_user_id ON public.games (user_id);
CREATE INDEX IF NOT EXISTS idx_goals_game_id ON public.goals (game_id);

-- Drop migration columns (keeps data; removes legacy linkage)
ALTER TABLE public.teams
DROP COLUMN IF EXISTS _m_legacy_home_team_id,
DROP COLUMN IF EXISTS _m_legacy_away_team_id;

ALTER TABLE public.team_players
DROP COLUMN IF EXISTS _m_legacy_home_player_id,
DROP COLUMN IF EXISTS _m_legacy_away_player_id;

ALTER TABLE public.games
DROP COLUMN IF EXISTS _m_legacy_game_id;

-- Drop legacy tables
DROP TABLE IF EXISTS public.z_legacy_goals;
DROP TABLE IF EXISTS public.z_legacy_game_home_players;
DROP TABLE IF EXISTS public.z_legacy_games;
DROP TABLE IF EXISTS public.z_legacy_away_team_players;
DROP TABLE IF EXISTS public.z_legacy_away_teams;
DROP TABLE IF EXISTS public.z_legacy_home_team_players;
DROP TABLE IF EXISTS public.z_legacy_home_teams;

-- Optional: remove old partial-unique indexes names if they linger (teams/table recreated clean - indexes on dropped cols auto dropped with columns? 
-- Dropping column drops indexes on those columns.)

COMMIT;

-- =============================================================================
-- Done. Verify:
-- SELECT column_name FROM information_schema.columns WHERE table_name='games' AND column_name IN ('team_a_id','away_team_id');
-- SELECT COUNT(*) FROM teams;
-- SELECT COUNT(*) FROM games;
-- =============================================================================
