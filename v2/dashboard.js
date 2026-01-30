// Dashboard JavaScript for V2
const API_BASE_URL = window.location.origin;
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');
let homeTeam = null;
let awayTeams = [];
let games = [];
let currentGame = null;

// Check authentication
if (!authToken) {
    window.location.href = 'login.html';
}

// Set user email
document.getElementById('userEmail').textContent = currentUser.email || '';

// API helper function
async function apiCall(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}/api/v2${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
            ...options.headers
        }
    });

    if (response.status === 401) {
        // Token expired
        logout();
        return null;
    }

    return response;
}

// Logout function
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');

    // Load data for the tab
    if (tabName === 'home-team') {
        loadHomeTeam();
    } else if (tabName === 'away-teams') {
        loadAwayTeams();
    } else if (tabName === 'games') {
        loadGames();
    }
}

// ========== HOME TEAM FUNCTIONS ==========

async function loadHomeTeam() {
    try {
        const response = await apiCall('/home-team');
        if (!response) return;
        
        const data = await response.json();
        homeTeam = data;

        document.getElementById('homeTeamName').value = data.team_name || '';
        document.getElementById('homeTeamColor').value = data.team_color || '#ff6b6b';

        renderHomeTeamPlayers();
    } catch (error) {
        console.error('Load home team error:', error);
        showMessage('homeTeamMessage', 'Error loading home team', 'error');
    }
}

async function saveHomeTeam() {
    try {
        const teamName = document.getElementById('homeTeamName').value;
        const teamColor = document.getElementById('homeTeamColor').value;

        const response = await apiCall('/home-team', {
            method: 'PUT',
            body: JSON.stringify({
                team_name: teamName,
                team_color: teamColor
            })
        });

        if (!response) return;

        if (response.ok) {
            showMessage('homeTeamMessage', 'Home team saved successfully!', 'success');
            await loadHomeTeam();
        } else {
            const error = await response.json();
            showMessage('homeTeamMessage', error.error || 'Error saving home team', 'error');
        }
    } catch (error) {
        console.error('Save home team error:', error);
        showMessage('homeTeamMessage', 'Error saving home team', 'error');
    }
}

async function addHomeTeamPlayer() {
    try {
        const playerName = document.getElementById('homePlayerName').value.trim();
        const playerNumber = parseInt(document.getElementById('homePlayerNumber').value);

        if (!playerName || !playerNumber || playerNumber < 1 || playerNumber > 99) {
            showMessage('homeTeamMessage', 'Please enter a valid name and number (1-99)', 'error');
            return;
        }

        const response = await apiCall('/home-team/players', {
            method: 'POST',
            body: JSON.stringify({
                player_name: playerName,
                player_number: playerNumber
            })
        });

        if (!response) return;

        if (response.ok) {
            document.getElementById('homePlayerName').value = '';
            document.getElementById('homePlayerNumber').value = '';
            showMessage('homeTeamMessage', 'Player added successfully!', 'success');
            await loadHomeTeam();
        } else {
            const error = await response.json();
            showMessage('homeTeamMessage', error.error || 'Error adding player', 'error');
        }
    } catch (error) {
        console.error('Add home team player error:', error);
        showMessage('homeTeamMessage', 'Error adding player', 'error');
    }
}

async function deleteHomeTeamPlayer(playerId) {
    if (!confirm('Are you sure you want to delete this player?')) return;

    try {
        const response = await apiCall(`/home-team/players/${playerId}`, {
            method: 'DELETE'
        });

        if (!response) return;

        if (response.ok) {
            showMessage('homeTeamMessage', 'Player deleted successfully!', 'success');
            await loadHomeTeam();
        } else {
            const error = await response.json();
            showMessage('homeTeamMessage', error.error || 'Error deleting player', 'error');
        }
    } catch (error) {
        console.error('Delete home team player error:', error);
        showMessage('homeTeamMessage', 'Error deleting player', 'error');
    }
}

function renderHomeTeamPlayers() {
    const list = document.getElementById('homeTeamPlayersList');
    if (!homeTeam || !homeTeam.players || homeTeam.players.length === 0) {
        list.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No players added yet</p>';
        return;
    }

    list.innerHTML = homeTeam.players.map(player => `
        <div class="player-item">
            <span><strong>#${player.player_number}</strong> ${player.player_name}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteHomeTeamPlayer(${player.id})">Delete</button>
        </div>
    `).join('');
}

// ========== AWAY TEAMS FUNCTIONS ==========

async function loadAwayTeams() {
    try {
        const response = await apiCall('/away-teams');
        if (!response) return;
        
        awayTeams = await response.json();
        renderAwayTeams();
    } catch (error) {
        console.error('Load away teams error:', error);
        showMessage('awayTeamsMessage', 'Error loading away teams', 'error');
    }
}

async function createAwayTeam() {
    try {
        const teamName = document.getElementById('newAwayTeamName').value.trim();
        const teamColor = document.getElementById('newAwayTeamColor').value;

        if (!teamName) {
            showMessage('awayTeamsMessage', 'Please enter a team name', 'error');
            return;
        }

        const response = await apiCall('/away-teams', {
            method: 'POST',
            body: JSON.stringify({
                team_name: teamName,
                team_color: teamColor
            })
        });

        if (!response) return;

        if (response.ok) {
            document.getElementById('newAwayTeamName').value = '';
            showMessage('awayTeamsMessage', 'Away team created successfully!', 'success');
            await loadAwayTeams();
            await loadGames(); // Refresh games dropdown
        } else {
            const error = await response.json();
            showMessage('awayTeamsMessage', error.error || 'Error creating away team', 'error');
        }
    } catch (error) {
        console.error('Create away team error:', error);
        showMessage('awayTeamsMessage', 'Error creating away team', 'error');
    }
}

async function deleteAwayTeam(teamId) {
    if (!confirm('Are you sure you want to delete this away team? This will also delete all associated games and goals.')) return;

    try {
        const response = await apiCall(`/away-teams/${teamId}`, {
            method: 'DELETE'
        });

        if (!response) return;

        if (response.ok) {
            showMessage('awayTeamsMessage', 'Away team deleted successfully!', 'success');
            await loadAwayTeams();
            await loadGames();
        } else {
            const error = await response.json();
            showMessage('awayTeamsMessage', error.error || 'Error deleting away team', 'error');
        }
    } catch (error) {
        console.error('Delete away team error:', error);
        showMessage('awayTeamsMessage', 'Error deleting away team', 'error');
    }
}

async function addAwayTeamPlayer(teamId) {
    try {
        const playerNameInput = document.getElementById(`awayPlayerName_${teamId}`);
        const playerNumberInput = document.getElementById(`awayPlayerNumber_${teamId}`);
        
        const playerName = playerNameInput.value.trim();
        const playerNumber = parseInt(playerNumberInput.value);

        if (!playerName || !playerNumber || playerNumber < 1 || playerNumber > 99) {
            showMessage('awayTeamsMessage', 'Please enter a valid name and number (1-99)', 'error');
            return;
        }

        const response = await apiCall(`/away-teams/${teamId}/players`, {
            method: 'POST',
            body: JSON.stringify({
                player_name: playerName,
                player_number: playerNumber
            })
        });

        if (!response) return;

        if (response.ok) {
            // Clear form fields
            playerNameInput.value = '';
            playerNumberInput.value = '';
            showMessage('awayTeamsMessage', 'Player added successfully!', 'success');
            await loadAwayTeams();
        } else {
            const error = await response.json();
            showMessage('awayTeamsMessage', error.error || 'Error adding player', 'error');
        }
    } catch (error) {
        console.error('Add away team player error:', error);
        showMessage('awayTeamsMessage', 'Error adding player', 'error');
    }
}

async function deleteAwayTeamPlayer(teamId, playerId) {
    if (!confirm('Are you sure you want to delete this player?')) return;

    try {
        const response = await apiCall(`/away-teams/${teamId}/players/${playerId}`, {
            method: 'DELETE'
        });

        if (!response) return;

        if (response.ok) {
            showMessage('awayTeamsMessage', 'Player deleted successfully!', 'success');
            await loadAwayTeams();
        } else {
            const error = await response.json();
            showMessage('awayTeamsMessage', error.error || 'Error deleting player', 'error');
        }
    } catch (error) {
        console.error('Delete away team player error:', error);
        showMessage('awayTeamsMessage', 'Error deleting player', 'error');
    }
}

function renderAwayTeams() {
    const list = document.getElementById('awayTeamsList');
    if (awayTeams.length === 0) {
        list.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No away teams created yet</p>';
        return;
    }

    list.innerHTML = awayTeams.map(team => `
        <div class="team-item">
            <div class="team-header">
                <span class="team-name" style="color: ${team.team_color}">${team.team_name}</span>
                <button class="btn btn-danger btn-sm" onclick="deleteAwayTeam(${team.id})">Delete Team</button>
            </div>
            <div style="margin-top: 15px;">
                <h4 style="margin-bottom: 10px; color: #34495e;">Players</h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="awayPlayerName_${team.id}">Player Name:</label>
                        <input type="text" id="awayPlayerName_${team.id}" placeholder="Enter player name">
                    </div>
                    <div class="form-group">
                        <label for="awayPlayerNumber_${team.id}">Player Number:</label>
                        <input type="number" id="awayPlayerNumber_${team.id}" placeholder="Number" min="1" max="99">
                    </div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="addAwayTeamPlayer(${team.id})" style="margin-bottom: 15px;">Add Player</button>
                <div class="players-list">
                    ${team.players && team.players.length > 0 ? team.players.map(player => `
                        <div class="player-item">
                            <span><strong>#${player.player_number}</strong> ${player.player_name}</span>
                            <button class="btn btn-danger btn-sm" onclick="deleteAwayTeamPlayer(${team.id}, ${player.id})">Delete</button>
                        </div>
                    `).join('') : '<p style="color: #7f8c8d; text-align: center; padding: 10px;">No players added yet</p>'}
                </div>
            </div>
        </div>
    `).join('');
}

// ========== GAMES FUNCTIONS ==========

async function loadGames() {
    try {
        const response = await apiCall('/games');
        if (!response) return;
        
        games = await response.json();
        renderGames();
        updateGamesDropdown();
        updateAttendingPlayersCheckboxes();
    } catch (error) {
        console.error('Load games error:', error);
        showMessage('gamesMessage', 'Error loading games', 'error');
    }
}

async function createGame() {
    try {
        const gameName = document.getElementById('newGameName').value.trim();
        const awayTeamId = document.getElementById('newGameAwayTeam').value;
        const checkboxes = document.querySelectorAll('#attendingPlayersCheckboxes input[type="checkbox"]:checked');
        const attendingPlayerIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

        if (!awayTeamId) {
            showMessage('gamesMessage', 'Please select an away team', 'error');
            return;
        }

        const response = await apiCall('/games', {
            method: 'POST',
            body: JSON.stringify({
                game_name: gameName || null,
                away_team_id: parseInt(awayTeamId),
                attending_home_player_ids: attendingPlayerIds
            })
        });

        if (!response) return;

        if (response.ok) {
            document.getElementById('newGameName').value = '';
            document.getElementById('newGameAwayTeam').value = '';
            // Uncheck all checkboxes
            document.querySelectorAll('#attendingPlayersCheckboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
            showMessage('gamesMessage', 'Game created successfully!', 'success');
            await loadGames();
        } else {
            const error = await response.json();
            showMessage('gamesMessage', error.error || 'Error creating game', 'error');
        }
    } catch (error) {
        console.error('Create game error:', error);
        showMessage('gamesMessage', 'Error creating game', 'error');
    }
}

function updateGamesDropdown() {
    const select = document.getElementById('newGameAwayTeam');
    select.innerHTML = '<option value="">Select away team</option>';
    
    awayTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.team_name;
        select.appendChild(option);
    });
}

function updateAttendingPlayersCheckboxes() {
    const container = document.getElementById('attendingPlayersCheckboxes');
    if (!homeTeam || !homeTeam.players || homeTeam.players.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; padding: 10px;">No home team players available. Add players in the Home Team section first.</p>';
        return;
    }

    container.innerHTML = homeTeam.players.map(player => `
        <div class="checkbox-item">
            <input type="checkbox" id="player_${player.id}" value="${player.id}">
            <label for="player_${player.id}">#${player.player_number} ${player.player_name}</label>
        </div>
    `).join('');
}

function renderGames() {
    const list = document.getElementById('gamesList');
    if (games.length === 0) {
        list.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No games created yet</p>';
        return;
    }

    list.innerHTML = games.map(game => `
        <div class="game-item" onclick="openGame(${game.id})">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${game.game_name || 'Unnamed Game'}</h3>
                    <p style="margin: 5px 0; color: #7f8c8d;">
                        <span style="color: ${game.away_team_color}">vs ${game.away_team_name}</span> | 
                        Created: ${new Date(game.created_at).toLocaleDateString()}
                    </p>
                    <p style="margin: 5px 0; color: #7f8c8d;">
                        Attending Players: ${game.attending_home_players ? game.attending_home_players.length : 0}
                    </p>
                </div>
                <button class="btn btn-primary" onclick="event.stopPropagation(); openGame(${game.id})">Open Game</button>
            </div>
        </div>
    `).join('');
}

function openGame(gameId) {
    window.location.href = `game.html?id=${gameId}`;
}

// ========== UTILITY FUNCTIONS ==========

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    element.className = type === 'error' ? 'error-message' : 'success-message';
    element.textContent = message;
    element.style.display = 'block';

    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
    await loadHomeTeam();
    await loadAwayTeams();
    await loadGames();
});

