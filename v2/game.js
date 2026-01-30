// Game page JavaScript
const API_BASE_URL = window.location.origin;
let authToken = localStorage.getItem('authToken');
let currentGame = null;
let homeTeam = null;
let awayTeam = null;

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
        const response = await apiCall(`/games/${gameId}`);
        if (!response) return;

        if (!response.ok) {
            const error = await response.json();
            showMessage(error.error || 'Error loading game', 'error');
            return;
        }

        currentGame = await response.json();

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
        updatePlayerDropdowns();
        renderGoals();
    } catch (error) {
        console.error('Load game error:', error);
        showMessage('Error loading game', 'error');
    }
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
    const scoringTeam = document.getElementById('scoringTeam').value;
    const scorerSelect = document.getElementById('scorer');
    const assist1Select = document.getElementById('assist1');
    const assist2Select = document.getElementById('assist2');

    let players = [];
    let isHome = scoringTeam === 'home';

    if (isHome) {
        // Get attending home players
        players = currentGame.attending_home_players || [];
    } else {
        // Get away team players
        players = awayTeam.players || [];
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
            showMessage('Please select a scorer', 'error');
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
        const goalData = {
            scoring_team: scoringTeam,
            scorer_name: scorerName,
            scorer_number: scorerNumber,
            assist1_name: assist1Name,
            assist2_name: assist2Name,
            period: period,
            time_remaining: timeRemaining
        };
        const announcementText = generateAnnouncement(goalData);

        // Save goal to database
        const response = await apiCall(`/games/${gameId}/goals`, {
            method: 'POST',
            body: JSON.stringify({
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
            })
        });

        if (!response) return;

        if (response.ok) {
            showMessage('Goal recorded successfully!', 'success');
            // Reset form
            document.getElementById('scorer').value = '';
            document.getElementById('assist1').value = '';
            document.getElementById('assist2').value = '';
            document.getElementById('timeRemaining').value = '4:25';
            // Reload goals
            await loadGame();
        } else {
            const error = await response.json();
            showMessage(error.error || 'Error recording goal', 'error');
        }
    } catch (error) {
        console.error('Record goal error:', error);
        showMessage('Error recording goal', 'error');
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
            showMessage('Goal deleted successfully!', 'success');
            await loadGame();
        } else {
            const error = await response.json();
            showMessage(error.error || 'Error deleting goal', 'error');
        }
    } catch (error) {
        console.error('Delete goal error:', error);
        showMessage('Error deleting goal', 'error');
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
            showMessage('Error generating announcement audio', 'error');
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


