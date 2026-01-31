// Game page JavaScript
const API_BASE_URL = window.location.origin;
let authToken = localStorage.getItem('authToken');
let currentGame = null;
let homeTeam = null;
let awayTeam = null;
let selectedVoice = localStorage.getItem('selectedVoice') || 'ErXwobaYiN019PkySvjV'; // Default to Antoni

// Check authentication
if (!authToken) {
    window.location.href = 'login.html';
}

// Get game ID from URL
const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('id');

if (!gameId) {
    window.location.href = 'dashboard.html';
}

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
        logout();
        return null;
    }

    return response;
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Load game data
async function loadGame() {
    try {
        console.log('Loading game with ID:', gameId);
        // Use POST to /games with id in body since routes with IDs don't route correctly
        const response = await apiCall(`/games`, {
            method: 'POST',
            body: JSON.stringify({
                _action: 'get',
                id: parseInt(gameId)
            })
        });
        console.log('Game response:', {
            ok: response?.ok,
            status: response?.status,
            statusText: response?.statusText
        });
        
        if (!response) {
            console.error('No response from apiCall');
            showMessage('gameMessage', 'Error loading game: No response', 'error');
            return;
        }

        if (!response.ok) {
            let errorMessage = 'Error loading game';
            try {
                const error = await response.json();
                errorMessage = error.error || errorMessage;
                console.error('Game load error:', error);
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                console.error('Game load error (non-JSON):', errorMessage);
            }
            showMessage('gameMessage', errorMessage, 'error');
            return;
        }

        currentGame = await response.json();
        console.log('Game loaded successfully:', currentGame);

        // Load home team
        const homeTeamResponse = await apiCall('/home-team');
        if (homeTeamResponse && homeTeamResponse.ok) {
            homeTeam = await homeTeamResponse.json();
        }

        // Away team is in currentGame
        awayTeam = {
            id: currentGame.away_team_id,
            team_name: currentGame.away_team_name,
            team_color: currentGame.away_team_color,
            players: [] // We'll need to load this separately
        };

        // Load away team players
        const awayTeamsResponse = await apiCall('/away-teams');
        if (awayTeamsResponse && awayTeamsResponse.ok) {
            const awayTeams = await awayTeamsResponse.json();
            const foundTeam = awayTeams.find(t => t.id === awayTeam.id);
            if (foundTeam) {
                awayTeam.players = foundTeam.players || [];
            }
        }

        renderGameInfo();
        renderAttendingPlayers();
        updatePlayerDropdowns();
        renderGoals();
    } catch (error) {
        console.error('Load game error:', error);
        showMessage('gameMessage', `Error loading game: ${error.message}`, 'error');
    }
}

// Initialize on page load
if (gameId) {
    loadGame();
}

// Tab switching
function switchGameTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// Render attending players checkboxes
function renderAttendingPlayers() {
    const container = document.getElementById('attendingPlayersCheckboxes');
    if (!homeTeam || !homeTeam.players || homeTeam.players.length === 0) {
        container.innerHTML = '<p style="color: #7f8c8d; padding: 10px;">No home team players available. Add players in the Home Team section first.</p>';
        return;
    }

    const attendingPlayerIds = (currentGame.attending_home_players || []).map(p => p.id);
    
    // If no players are marked as attending, default to all players attending
    const hasAttendingPlayers = attendingPlayerIds.length > 0;
    const defaultToAll = !hasAttendingPlayers;

    container.innerHTML = homeTeam.players.map(player => {
        // Check if player is attending, or default to checked if no players are attending yet
        const isChecked = defaultToAll || attendingPlayerIds.includes(player.id);
        return `
            <div class="checkbox-item">
                <input type="checkbox" id="attending_${player.id}" value="${player.id}" ${isChecked ? 'checked' : ''}>
                <label for="attending_${player.id}">#${player.player_number} ${player.player_name}</label>
            </div>
        `;
    }).join('');
}

// Save attending players
async function saveAttendingPlayers() {
    try {
        const checkboxes = document.querySelectorAll('#attendingPlayersCheckboxes input[type="checkbox"]:checked');
        const attendingPlayerIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        console.log('Saving attending players:', { gameId, attendingPlayerIds });

        // Try POST to /games/:id first, then fallback to /games with id in body (like away-teams)
        let response = await apiCall(`/games/${gameId}`, {
            method: 'POST',
            body: JSON.stringify({
                _action: 'update-attending-players',
                attending_home_player_ids: attendingPlayerIds
            })
        });
        
        // Check if first attempt failed
        if (!response || !response.ok) {
            console.log('First attempt failed (status:', response?.status, '), trying workaround pattern');
            // Try the workaround pattern (POST to /games with id in body)
            response = await apiCall(`/games`, {
                method: 'POST',
                body: JSON.stringify({
                    _action: 'update-attending-players',
                    id: parseInt(gameId),
                    attending_home_player_ids: attendingPlayerIds
                })
            });
            console.log('Fallback response:', { ok: response?.ok, status: response?.status });
        }

        if (!response) {
            console.error('No response from saveAttendingPlayers after both attempts');
            showMessage('attendingMessage', 'Error: No response from server', 'error');
            return;
        }

        console.log('Save attending players response:', { ok: response.ok, status: response.status });

        if (response.ok) {
            const updatedGame = await response.json();
            console.log('Attending players saved successfully:', updatedGame);
            showMessage('attendingMessage', 'Attending players updated successfully!', 'success');
            // Update currentGame with the response
            currentGame.attending_home_players = updatedGame.attending_home_players || [];
            // Re-render to show updated state
            renderAttendingPlayers();
            updatePlayerDropdowns();
        } else {
            let errorMessage = 'Error updating attending players';
            try {
                const error = await response.json();
                errorMessage = error.error || errorMessage;
                console.error('Save attending players error:', error);
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`;
                console.error('Save attending players error (non-JSON):', errorMessage);
            }
            showMessage('attendingMessage', errorMessage, 'error');
        }
    } catch (error) {
        console.error('Save attending players error:', error);
        showMessage('attendingMessage', `Error updating attending players: ${error.message}`, 'error');
    }
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) {
        // Fallback if element doesn't exist
        console.error(`Element ${elementId} not found for message:`, message);
        return;
    }
    
    element.className = type === 'error' ? 'error-message' : 'success-message';
    element.textContent = message;
    element.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function renderGameInfo() {
    document.getElementById('gameTitle').textContent = currentGame.game_name || 'Unnamed Game';
    document.getElementById('gameInfo').innerHTML = `
        <strong>vs ${awayTeam.team_name}</strong> | 
        Created: ${new Date(currentGame.created_at).toLocaleDateString()} | 
        Goals: ${currentGame.goals ? currentGame.goals.length : 0}
    `;
}

function updatePlayerDropdowns() {
    // Don't update if game data isn't loaded yet
    if (!currentGame || !awayTeam) {
        console.log('Cannot update player dropdowns - game data not loaded', { currentGame, awayTeam });
        return;
    }
    
    const scoringTeam = document.getElementById('scoringTeam').value;
    const scorerSelect = document.getElementById('scorer');
    const assist1Select = document.getElementById('assist1');
    const assist2Select = document.getElementById('assist2');

    if (!scorerSelect || !assist1Select || !assist2Select) {
        console.log('Dropdown elements not found');
        return;
    }

    let players = [];
    let isHome = scoringTeam === 'home';

    if (isHome) {
        // Get attending home players
        players = (currentGame && currentGame.attending_home_players) ? currentGame.attending_home_players : [];
    } else {
        // Get away team players
        players = (awayTeam && awayTeam.players) ? awayTeam.players : [];
    }

    // Update scorer dropdown
    scorerSelect.innerHTML = '<option value="">Select scorer</option>';
    players.forEach(player => {
        const option = document.createElement('option');
        option.value = `${player.id}|${isHome}`;
        option.textContent = `#${player.player_number} ${player.player_name}`;
        scorerSelect.appendChild(option);
    });

    // Update assist dropdowns
    [assist1Select, assist2Select].forEach(select => {
        select.innerHTML = '<option value="">No assist</option>';
        players.forEach(player => {
            const option = document.createElement('option');
            option.value = `${player.id}|${isHome}`;
            option.textContent = `#${player.player_number} ${player.player_name}`;
            select.appendChild(option);
        });
    });
}

function generateAnnouncement(goal) {
    let announcement = `Goal for the ${goal.scoring_team === 'home' ? homeTeam.team_name : awayTeam.team_name}! by number ${goal.scorer_number}, ${goal.scorer_name}`;
    
    if (goal.assist1_name) {
        announcement += `, assisted by ${goal.assist1_name}`;
        if (goal.assist2_name) {
            announcement += ` and ${goal.assist2_name}`;
        }
    } else {
        announcement += `, unassisted`;
    }
    
    const periodText = goal.period === 'ot' ? 'overtime' : 
        goal.period === '1' ? 'first' : 
        goal.period === '2' ? 'second' : 'third';
    
    announcement += `, in the ${periodText} period with ${goal.time_remaining} remaining.`;

    return announcement;
}

async function recordGoal(event) {
    event.preventDefault();

    try {
        const scoringTeam = document.getElementById('scoringTeam').value;
        const scorerData = document.getElementById('scorer').value;
        const assist1Data = document.getElementById('assist1').value;
        const assist2Data = document.getElementById('assist2').value;
        const period = document.getElementById('period').value;
        const timeRemaining = document.getElementById('timeRemaining').value;

        if (!scorerData) {
            showMessage('gameMessage', 'Please select a scorer', 'error');
            return;
        }

        const [scorerId, scorerIsHome] = scorerData.split('|');
        const assist1 = assist1Data ? assist1Data.split('|') : null;
        const assist2 = assist2Data ? assist2Data.split('|') : null;

        // Get player names for announcement
        let scorerName, scorerNumber;
        let assist1Name = null, assist2Name = null;

        if (scorerIsHome === 'true') {
            const player = currentGame.attending_home_players.find(p => p.id === parseInt(scorerId));
            scorerName = player.player_name;
            scorerNumber = player.player_number;
        } else {
            const player = awayTeam.players.find(p => p.id === parseInt(scorerId));
            scorerName = player.player_name;
            scorerNumber = player.player_number;
        }

        if (assist1) {
            const assist1IsHome = assist1[1] === 'true';
            if (assist1IsHome) {
                const player = currentGame.attending_home_players.find(p => p.id === parseInt(assist1[0]));
                assist1Name = player ? player.player_name : null;
            } else {
                const player = awayTeam.players.find(p => p.id === parseInt(assist1[0]));
                assist1Name = player ? player.player_name : null;
            }
        }

        if (assist2) {
            const assist2IsHome = assist2[1] === 'true';
            if (assist2IsHome) {
                const player = currentGame.attending_home_players.find(p => p.id === parseInt(assist2[0]));
                assist2Name = player ? player.player_name : null;
            } else {
                const player = awayTeam.players.find(p => p.id === parseInt(assist2[0]));
                assist2Name = player ? player.player_name : null;
            }
        }

        // Generate announcement text
        const announcementData = {
            scoring_team: scoringTeam,
            scorer_name: scorerName,
            scorer_number: scorerNumber,
            assist1_name: assist1Name,
            assist2_name: assist2Name,
            period: period,
            time_remaining: timeRemaining
        };
        const announcementText = generateAnnouncement(announcementData);

        // Save goal to database - try direct route first, then fallback
        // Use field names that match database schema
        const goalData = {
            scoring_team: scoringTeam,
            scorer_player_id: parseInt(scorerId),
            scorer_is_home: scorerIsHome === 'true',
            assist1_player_id: assist1 ? parseInt(assist1[0]) : null,
            assist1_is_home: assist1 ? assist1[1] === 'true' : null,
            assist2_player_id: assist2 ? parseInt(assist2[0]) : null,
            assist2_is_home: assist2 ? assist2[1] === 'true' : null,
            period: period,
            time_remaining: timeRemaining,
            announcement_text: announcementText
        };
        
        let response = await apiCall(`/games/${gameId}/goals`, {
            method: 'POST',
            body: JSON.stringify(goalData)
        });
        
        // If 404, try fallback pattern (POST to /games with game_id and _action in body)
        if (!response || !response.ok) {
            console.log('First goal save attempt failed (status:', response?.status, '), trying fallback pattern');
            response = await apiCall(`/games`, {
                method: 'POST',
                body: JSON.stringify({
                    _action: 'record-goal',
                    game_id: parseInt(gameId),
                    ...goalData
                })
            });
            console.log('Fallback goal save response:', { ok: response?.ok, status: response?.status });
        }

        if (!response) return;

        if (response.ok) {
            showMessage('gameMessage', 'Goal recorded successfully!', 'success');
            // Reset form
            document.getElementById('scorer').value = '';
            document.getElementById('assist1').value = '';
            document.getElementById('assist2').value = '';
            document.getElementById('timeRemaining').value = '4:25';
            // Reload goals
            await loadGame();
        } else {
            let errorMessage = 'Error recording goal';
            try {
                const error = await response.json();
                errorMessage = error.error || errorMessage;
            } catch (e) {
                errorMessage = `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`;
            }
            showMessage('gameMessage', errorMessage, 'error');
        }
    } catch (error) {
        console.error('Record goal error:', error);
        showMessage('gameMessage', 'Error recording goal', 'error');
    }
}

async function deleteGoal(goalId) {
    if (!confirm('Are you sure you want to delete this goal?')) return;

    try {
        const response = await apiCall(`/games/${gameId}/goals/${goalId}`, {
            method: 'DELETE'
        });

        if (!response) return;

        if (response.ok) {
            showMessage('gameMessage', 'Goal deleted successfully!', 'success');
            await loadGame();
        } else {
            const error = await response.json();
            showMessage('gameMessage', error.error || 'Error deleting goal', 'error');
        }
    } catch (error) {
        console.error('Delete goal error:', error);
        showMessage('gameMessage', 'Error deleting goal', 'error');
    }
}

async function playAnnouncement(announcementText) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: announcementText,
                voice: 'ErXwobaYiN019PkySvjV' // Antoni voice
            })
        });

        if (response.ok) {
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
            };
            
            audio.onerror = (event) => {
                console.error('Audio playback error:', event);
                showMessage('Error playing announcement', 'error');
            };
            
            audio.play();
        } else {
            showMessage('gameMessage', 'Error generating announcement audio', 'error');
        }
    } catch (error) {
        console.error('Play announcement error:', error);
        showMessage('Error playing announcement', 'error');
    }
}

function renderGoals() {
    const list = document.getElementById('goalsList');
    if (!currentGame.goals || currentGame.goals.length === 0) {
        list.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No goals recorded yet</p>';
        return;
    }

    list.innerHTML = currentGame.goals.map(goal => {
        // Parse announcement to get team name
        const teamMatch = goal.announcement_text.match(/Goal for the (.+?)!/);
        const teamName = teamMatch ? teamMatch[1] : (goal.scoring_team === 'home' ? homeTeam.team_name : awayTeam.team_name);
        const teamColor = goal.scoring_team === 'home' ? homeTeam.team_color : awayTeam.team_color;

        return `
            <div class="goal-item">
                <div class="goal-info">
                    <span class="goal-team" style="background-color: ${teamColor}">${teamName}</span>
                    <span class="goal-scorer">${goal.announcement_text}</span>
                    <span class="goal-time">${goal.period === 'ot' ? 'OT' : `P${goal.period}`} ${goal.time_remaining}</span>
                </div>
                <div class="goal-actions">
                    <button class="btn btn-secondary btn-sm" onclick="playAnnouncement('${goal.announcement_text.replace(/'/g, "\\'")}')">Play</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteGoal(${goal.id})">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('gameMessage');
    messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';

    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    loadGame();
});


