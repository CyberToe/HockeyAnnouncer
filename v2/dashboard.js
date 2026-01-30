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
        // Load away teams first to populate dropdown, then load games
        loadAwayTeams().then(() => {
            updateGamesDropdown();
            loadGames();
        });
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
        // Update games dropdown if we're on the games tab
        updateGamesDropdown();
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
            const newTeam = await response.json();
            document.getElementById('newAwayTeamName').value = '';
            document.getElementById('newAwayTeamColor').value = '#4ecdc4';
            showMessage('awayTeamsMessage', 'Away team created successfully!', 'success');
            await loadAwayTeams();
            await loadGames(); // Refresh games dropdown
            // Auto-select the newly created team
            document.getElementById('awayTeamSelector').value = newTeam.id;
            selectAwayTeam();
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
            selectedAwayTeamId = null;
            document.getElementById('selectedAwayTeamDetails').style.display = 'none';
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
        const playerNameInput = document.getElementById('selectedAwayPlayerName');
        const playerNumberInput = document.getElementById('selectedAwayPlayerNumber');
        
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
            // Re-select the team to refresh the view
            document.getElementById('awayTeamSelector').value = teamId;
            selectAwayTeam();
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
            // Re-select the team to refresh the view
            if (selectedAwayTeamId) {
                document.getElementById('awayTeamSelector').value = selectedAwayTeamId;
                selectAwayTeam();
            }
        } else {
            const error = await response.json();
            showMessage('awayTeamsMessage', error.error || 'Error deleting player', 'error');
        }
    } catch (error) {
        console.error('Delete away team player error:', error);
        showMessage('awayTeamsMessage', 'Error deleting player', 'error');
    }
}

let selectedAwayTeamId = null;

function renderAwayTeams() {
    const selector = document.getElementById('awayTeamSelector');
    if (!selector) return;
    
    // Save current selection
    const currentSelection = selector.value;
    
    selector.innerHTML = '<option value="">-- Select a team to view/edit --</option>';
    
    if (awayTeams.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No away teams created yet';
        option.disabled = true;
        selector.appendChild(option);
        return;
    }
    
    awayTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.team_name;
        selector.appendChild(option);
    });
    
    // Restore selection if it still exists
    if (currentSelection && awayTeams.find(t => t.id.toString() === currentSelection)) {
        selector.value = currentSelection;
        selectAwayTeam();
    } else {
        // Clear selection if team was deleted
        selectedAwayTeamId = null;
        document.getElementById('selectedAwayTeamDetails').style.display = 'none';
    }
}

function selectAwayTeam() {
    const selector = document.getElementById('awayTeamSelector');
    const teamId = selector.value;
    
    if (!teamId) {
        selectedAwayTeamId = null;
        document.getElementById('selectedAwayTeamDetails').style.display = 'none';
        return;
    }
    
    selectedAwayTeamId = parseInt(teamId);
    const team = awayTeams.find(t => t.id === selectedAwayTeamId);
    
    if (!team) {
        showMessage('awayTeamsMessage', 'Team not found', 'error');
        return;
    }
    
    // Populate team details
    document.getElementById('editAwayTeamName').value = team.team_name;
    document.getElementById('editAwayTeamColor').value = team.team_color;
    
    // Render players
    renderSelectedAwayTeamPlayers(team);
    
    // Show the details section
    document.getElementById('selectedAwayTeamDetails').style.display = 'block';
}

function renderSelectedAwayTeamPlayers(team) {
    const container = document.getElementById('selectedAwayTeamPlayers');
    if (!team.players || team.players.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 10px;">No players added yet</p>';
        return;
    }
    
    container.innerHTML = team.players.map(player => `
        <div class="player-item">
            <span><strong>#${player.player_number}</strong> ${player.player_name}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteAwayTeamPlayer(${team.id}, ${player.id})">Delete</button>
        </div>
    `).join('');
}

async function updateAwayTeam() {
    if (!selectedAwayTeamId) {
        showMessage('awayTeamsMessage', 'Please select a team first', 'error');
        return;
    }
    
    try {
        const teamName = document.getElementById('editAwayTeamName').value.trim();
        const teamColor = document.getElementById('editAwayTeamColor').value;
        
        if (!teamName) {
            showMessage('awayTeamsMessage', 'Team name is required', 'error');
            return;
        }
        
        const response = await apiCall(`/away-teams/${selectedAwayTeamId}`, {
            method: 'PUT',
            body: JSON.stringify({
                team_name: teamName,
                team_color: teamColor
            })
        });
        
        if (!response) return;
        
        if (response.ok) {
            showMessage('awayTeamsMessage', 'Team updated successfully!', 'success');
            await loadAwayTeams();
            // Re-select the team to refresh the view
            document.getElementById('awayTeamSelector').value = selectedAwayTeamId;
            selectAwayTeam();
        } else {
            const error = await response.json();
            showMessage('awayTeamsMessage', error.error || 'Error updating team', 'error');
        }
    } catch (error) {
        console.error('Update away team error:', error);
        showMessage('awayTeamsMessage', 'Error updating team', 'error');
    }
}

async function deleteSelectedAwayTeam() {
    if (!selectedAwayTeamId) {
        showMessage('awayTeamsMessage', 'Please select a team first', 'error');
        return;
    }
    
    await deleteAwayTeam(selectedAwayTeamId);
}

async function addSelectedAwayTeamPlayer() {
    if (!selectedAwayTeamId) {
        showMessage('awayTeamsMessage', 'Please select a team first', 'error');
        return;
    }
    
    await addAwayTeamPlayer(selectedAwayTeamId);
}

// ========== GAMES FUNCTIONS ==========

async function loadGames() {
    try {
        const response = await apiCall('/games');
        if (!response) return;
        
        games = await response.json();
        renderGames();
        // Update dropdown when games are loaded (away teams should already be loaded)
        updateGamesDropdown();
    } catch (error) {
        console.error('Load games error:', error);
        showMessage('gamesMessage', 'Error loading games', 'error');
    }
}

async function createGame() {
    try {
        const gameName = document.getElementById('newGameName').value.trim();
        const awayTeamId = document.getElementById('newGameAwayTeam').value;

        if (!awayTeamId) {
            showMessage('gamesMessage', 'Please select an away team', 'error');
            return;
        }

        const response = await apiCall('/games', {
            method: 'POST',
            body: JSON.stringify({
                game_name: gameName || null,
                away_team_id: parseInt(awayTeamId),
                attending_home_player_ids: [] // Empty array - will be set when in the game
            })
        });

        if (!response) return;

        if (response.ok) {
            document.getElementById('newGameName').value = '';
            document.getElementById('newGameAwayTeam').value = '';
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
    if (!select) return; // Element might not exist if not on games tab
    
    select.innerHTML = '<option value="">Select away team</option>';
    
    if (!awayTeams || awayTeams.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'No away teams available - create one in Away Teams tab';
        option.disabled = true;
        select.appendChild(option);
        return;
    }
    
    awayTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.team_name;
        select.appendChild(option);
    });
}

// Removed updateAttendingPlayersCheckboxes - attending players are now selected in the game view

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

