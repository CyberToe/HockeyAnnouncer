// Dashboard — teams and games (no home/away)
const API_BASE_URL = window.location.origin;
let authToken = localStorage.getItem('authToken');
let currentUser = JSON.parse(localStorage.getItem('user') || '{}');
let teams = [];
let games = [];
let selectedTeamId = null;

if (!authToken) {
    window.location.href = 'login.html';
}

document.getElementById('userEmail').textContent = currentUser.email || '';

async function apiCall(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}/api/v2${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
            ...options.headers
        }
    });
    if (response.status === 401) {
        logout();
        return null;
    }
    return response;
}

/** When the server returns HTML (e.g. Vercel 404), JSON.parse would throw — use this on error paths. */
async function readErrorMessage(response) {
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
        try {
            const j = await response.json();
            return j.error || j.message || `HTTP ${response.status}`;
        } catch {
            return `HTTP ${response.status}`;
        }
    }
    try {
        const text = await response.text();
        return text.trim().slice(0, 200) || `HTTP ${response.status}`;
    } catch {
        return `HTTP ${response.status}`;
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    if (tabName === 'teams') {
        loadTeams();
    } else if (tabName === 'games') {
        loadTeams().then(() => {
            populateGameTeamSelects();
            loadGames();
        });
    }
}

async function loadTeams() {
    try {
        const response = await apiCall('/teams');
        if (!response) return;
        teams = await response.json();
        renderTeamSelector();
        populateGameTeamSelects();
    } catch (e) {
        console.error(e);
        showMessage('teamsMessage', 'Error loading teams', 'error');
    }
}

async function createTeam() {
    const teamName = document.getElementById('newTeamName').value.trim();
    const teamColor = document.getElementById('newTeamColor').value;
    if (!teamName) {
        showMessage('teamsMessage', 'Please enter a team name', 'error');
        return;
    }
    const response = await apiCall('/teams', {
        method: 'POST',
        body: JSON.stringify({ team_name: teamName, team_color: teamColor })
    });
    if (!response) return;
    if (response.ok) {
        const newTeam = await response.json();
        document.getElementById('newTeamName').value = '';
        document.getElementById('newTeamColor').value = '#4ecdc4';
        showMessage('teamsMessage', 'Team created', 'success');
        await loadTeams();
        document.getElementById('teamSelector').value = newTeam.id;
        selectTeam();
    } else {
        showMessage('teamsMessage', await readErrorMessage(response), 'error');
    }
}

async function deleteTeam(teamId) {
    if (!confirm('Delete this team? Games that use it will be removed.')) return;
    const response = await apiCall(`/teams/${teamId}`, { method: 'DELETE' });
    if (!response) return;
    if (response.ok) {
        selectedTeamId = null;
        document.getElementById('selectedTeamDetails').style.display = 'none';
        showMessage('teamsMessage', 'Team deleted', 'success');
        await loadTeams();
        await loadGames();
    } else {
        showMessage('teamsMessage', await readErrorMessage(response), 'error');
    }
}

async function addTeamPlayer(teamId) {
    const nameInput = document.getElementById('selectedPlayerName');
    const numInput = document.getElementById('selectedPlayerNumber');
    const playerName = nameInput.value.trim();
    const playerNumber = parseInt(numInput.value, 10);
    if (!playerName || !playerNumber || playerNumber < 1 || playerNumber > 99) {
        showMessage('teamsMessage', 'Enter a valid name and number (1–99)', 'error');
        return;
    }
    const response = await apiCall(`/teams/${teamId}/players`, {
        method: 'POST',
        body: JSON.stringify({ player_name: playerName, player_number: playerNumber })
    });
    if (!response) return;
    if (response.ok) {
        nameInput.value = '';
        numInput.value = '';
        showMessage('teamsMessage', 'Player added', 'success');
        await loadTeams();
        document.getElementById('teamSelector').value = teamId;
        selectTeam();
    } else {
        showMessage('teamsMessage', await readErrorMessage(response), 'error');
    }
}

async function deleteTeamPlayer(teamId, playerId) {
    if (!confirm('Delete this player?')) return;
    const response = await apiCall(`/teams/${teamId}/players/${playerId}`, { method: 'DELETE' });
    if (!response) return;
    if (response.ok) {
        showMessage('teamsMessage', 'Player deleted', 'success');
        await loadTeams();
        if (selectedTeamId) {
            document.getElementById('teamSelector').value = selectedTeamId;
            selectTeam();
        }
    } else {
        showMessage('teamsMessage', await readErrorMessage(response), 'error');
    }
}

function renderTeamSelector() {
    const selector = document.getElementById('teamSelector');
    const current = selector.value;
    selector.innerHTML = '<option value="">-- Select a team to view or edit --</option>';
    if (teams.length === 0) {
        const o = document.createElement('option');
        o.value = '';
        o.textContent = 'No teams yet';
        o.disabled = true;
        selector.appendChild(o);
        return;
    }
    teams.forEach((team) => {
        const o = document.createElement('option');
        o.value = team.id;
        o.textContent = team.team_name;
        selector.appendChild(o);
    });
    if (current && teams.find((t) => t.id.toString() === current)) {
        selector.value = current;
        selectTeam();
    } else {
        selectedTeamId = null;
        document.getElementById('selectedTeamDetails').style.display = 'none';
    }
}

function selectTeam() {
    const selector = document.getElementById('teamSelector');
    const teamId = selector.value;
    if (!teamId) {
        selectedTeamId = null;
        document.getElementById('selectedTeamDetails').style.display = 'none';
        return;
    }
    selectedTeamId = parseInt(teamId, 10);
    const team = teams.find((t) => t.id === selectedTeamId);
    if (!team) {
        showMessage('teamsMessage', 'Team not found', 'error');
        return;
    }
    document.getElementById('editTeamName').value = team.team_name;
    document.getElementById('editTeamColor').value = team.team_color;
    renderSelectedTeamPlayers(team);
    document.getElementById('selectedTeamDetails').style.display = 'block';
}

function renderSelectedTeamPlayers(team) {
    const container = document.getElementById('selectedTeamPlayers');
    if (!team.players || team.players.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 10px;">No players yet</p>';
        return;
    }
    container.innerHTML = team.players
        .map(
            (p) => `
        <div class="player-item">
            <span><strong>#${p.player_number}</strong> ${p.player_name}</span>
            <button class="btn btn-danger btn-sm" onclick="deleteTeamPlayer(${team.id}, ${p.id})">Delete</button>
        </div>`
        )
        .join('');
}

async function updateTeam() {
    if (!selectedTeamId) {
        showMessage('teamsMessage', 'Select a team first', 'error');
        return;
    }
    const teamName = document.getElementById('editTeamName').value.trim();
    const teamColor = document.getElementById('editTeamColor').value;
    if (!teamName) {
        showMessage('teamsMessage', 'Team name is required', 'error');
        return;
    }
    const response = await apiCall('/teams', {
        method: 'POST',
        body: JSON.stringify({
            id: selectedTeamId,
            _action: 'update',
            team_name: teamName,
            team_color: teamColor
        })
    });
    if (!response) return;
    if (response.ok) {
        showMessage('teamsMessage', 'Team updated', 'success');
        await loadTeams();
        document.getElementById('teamSelector').value = selectedTeamId;
        selectTeam();
    } else {
        showMessage('teamsMessage', await readErrorMessage(response), 'error');
    }
}

async function deleteSelectedTeam() {
    if (!selectedTeamId) {
        showMessage('teamsMessage', 'Select a team first', 'error');
        return;
    }
    await deleteTeam(selectedTeamId);
}

function addSelectedTeamPlayer() {
    if (!selectedTeamId) {
        showMessage('teamsMessage', 'Select a team first', 'error');
        return;
    }
    addTeamPlayer(selectedTeamId);
}

function populateGameTeamSelects() {
    ['newGameTeamA', 'newGameTeamB'].forEach((id) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = '<option value="">Select team</option>';
        teams.forEach((t) => {
            const o = document.createElement('option');
            o.value = t.id;
            o.textContent = t.team_name;
            sel.appendChild(o);
        });
        if (cur && teams.find((t) => t.id.toString() === cur)) sel.value = cur;
    });
}

async function loadGames() {
    try {
        const response = await apiCall('/games');
        if (!response) return;
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            showMessage('gamesMessage', err.error || 'Error loading games', 'error');
            return;
        }
        games = await response.json();
        renderGames();
    } catch (e) {
        console.error(e);
        games = [];
        showMessage('gamesMessage', 'Error loading games', 'error');
    }
}

async function createGame() {
    const gameName = document.getElementById('newGameName').value.trim();
    const teamA = document.getElementById('newGameTeamA').value;
    const teamB = document.getElementById('newGameTeamB').value;
    if (!teamA || !teamB) {
        showMessage('gamesMessage', 'Select both teams', 'error');
        return;
    }
    if (teamA === teamB) {
        showMessage('gamesMessage', 'Choose two different teams', 'error');
        return;
    }
    const response = await apiCall('/games', {
        method: 'POST',
        body: JSON.stringify({
            game_name: gameName || null,
            team_a_id: parseInt(teamA, 10),
            team_b_id: parseInt(teamB, 10),
            attending_player_ids: []
        })
    });
    if (!response) return;
    if (response.ok) {
        document.getElementById('newGameName').value = '';
        document.getElementById('newGameTeamA').value = '';
        document.getElementById('newGameTeamB').value = '';
        showMessage('gamesMessage', 'Game created', 'success');
        await loadGames();
    } else {
        showMessage('gamesMessage', await readErrorMessage(response), 'error');
    }
}

function renderGames() {
    const list = document.getElementById('gamesList');
    if (games.length === 0) {
        list.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No games yet</p>';
        return;
    }
    list.innerHTML = games
        .map(
            (game) => `
        <div class="game-item" onclick="openGame(${game.id})">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0 0 10px 0; color: #2c3e50;">${game.game_name || 'Unnamed game'}</h3>
                    <p style="margin: 5px 0; color: #7f8c8d;">
                        <span style="color: ${game.team_a_color}">${game.team_a_name}</span>
                        vs
                        <span style="color: ${game.team_b_color}">${game.team_b_name}</span>
                        · ${new Date(game.created_at).toLocaleDateString()}
                    </p>
                    <p style="margin: 5px 0; color: #7f8c8d;">
                        Attending players: ${game.attending_players ? game.attending_players.length : 0}
                    </p>
                </div>
                <button class="btn btn-primary" onclick="event.stopPropagation(); openGame(${game.id})">Open game</button>
            </div>
        </div>`
        )
        .join('');
}

function openGame(gameId) {
    window.location.href = `game.html?id=${gameId}`;
}

function showMessage(elementId, message, type) {
    const el = document.getElementById(elementId);
    el.className = type === 'error' ? 'error-message' : 'success-message';
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => {
        el.style.display = 'none';
    }, 5000);
}

const DEMO_VIDEO_EMBED = 'https://www.youtube.com/embed/0hOHVlVUnfA';

function openDemoModal() {
    const modal = document.getElementById('demoModal');
    const iframe = document.getElementById('demoVideoIframe');
    if (!modal || !iframe) return;
    iframe.src = DEMO_VIDEO_EMBED;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

function closeDemoModal() {
    const modal = document.getElementById('demoModal');
    const iframe = document.getElementById('demoVideoIframe');
    if (!modal || !iframe) return;
    iframe.src = '';
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modal = document.getElementById('demoModal');
    if (modal && modal.classList.contains('is-open')) closeDemoModal();
});

window.addEventListener('DOMContentLoaded', async () => {
    await loadTeams();
    await loadGames();
});
