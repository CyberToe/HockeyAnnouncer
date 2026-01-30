# Hockey Goal Announcer V2 - Setup Instructions

## Prerequisites

1. **Neon Database Account**
   - Sign up at https://neon.tech
   - Create a new project
   - Copy your connection string

2. **Node.js and npm** installed

## Setup Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory with the following:

```env
# Neon Database Connection String
DATABASE_URL=postgresql://username:password@hostname/database?sslmode=require

# JWT Secret (generate a random string for production)
JWT_SECRET=your-secret-key-here-change-this-in-production

# Node Environment
NODE_ENV=development
```

**Important:** Replace `DATABASE_URL` with your actual Neon database connection string.

### 3. Initialize Database Schema

The database schema will be automatically initialized when you start the server. The schema includes:

- `users` - User accounts
- `home_teams` - Home team (one per user)
- `home_team_players` - Players on home team
- `away_teams` - Away teams (multiple per user)
- `away_team_players` - Players on away teams
- `games` - Game records
- `game_home_players` - Attending home players for each game
- `goals` - Goal records

### 4. Start the Server

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

### 5. Access the Application

- **V1 (Original)**: http://localhost:3000/
- **V2 Login**: http://localhost:3000/v2/login.html

## Features

### V2 Features

1. **User Authentication**
   - Register new accounts
   - Login with email and password
   - JWT-based session management

2. **Home Team Management**
   - One home team per user
   - Add/edit team name and color
   - Manage players (name and number)

3. **Away Teams Management**
   - Create multiple away teams
   - Each team has its own name, color, and players
   - Delete teams and players

4. **Games Management**
   - Create games with:
     - Game name (optional)
     - Away team selection
     - Attending home players selection
   - View all games
   - Open games to record goals

5. **Goal Recording**
   - Record goals with:
     - Scoring team (home/away)
     - Scorer
     - Assists (up to 2)
     - Period
     - Time remaining
   - Goals are saved to database
   - Manual play button (no auto-play)
   - Delete goals

## Database Schema

The database uses PostgreSQL (via Neon) with the following structure:

- All data is user-scoped (users can only see their own data)
- Foreign key constraints ensure data integrity
- Indexes optimize query performance

## API Endpoints

All V2 API endpoints require authentication via JWT token:

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/v2/home-team` - Get home team
- `PUT /api/v2/home-team` - Update home team
- `POST /api/v2/home-team/players` - Add home team player
- `DELETE /api/v2/home-team/players/:id` - Delete home team player
- `GET /api/v2/away-teams` - Get all away teams
- `POST /api/v2/away-teams` - Create away team
- `PUT /api/v2/away-teams/:id` - Update away team
- `DELETE /api/v2/away-teams/:id` - Delete away team
- `POST /api/v2/away-teams/:teamId/players` - Add away team player
- `DELETE /api/v2/away-teams/:teamId/players/:playerId` - Delete away team player
- `GET /api/v2/games` - Get all games
- `POST /api/v2/games` - Create game
- `GET /api/v2/games/:id` - Get single game
- `POST /api/v2/games/:gameId/goals` - Record goal
- `DELETE /api/v2/games/:gameId/goals/:goalId` - Delete goal

## Troubleshooting

### Database Connection Issues

- Verify your `DATABASE_URL` is correct
- Check that your Neon database is active
- Ensure SSL mode is set correctly in connection string

### Authentication Issues

- Clear browser localStorage if token issues occur
- Check that JWT_SECRET is set in `.env`

### Port Already in Use

- Change `PORT` in `.env` or use a different port
- Default port is 3000

## Security Notes

- Never commit `.env` file to version control
- Use a strong, random `JWT_SECRET` in production
- Passwords are hashed using bcrypt
- All API endpoints require authentication (except auth endpoints)

