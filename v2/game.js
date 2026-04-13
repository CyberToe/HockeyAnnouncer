// Game page — two teams (team_a / team_b), attending selection, goals
const API_BASE_URL = window.location.origin;
let authToken = localStorage.getItem('authToken');
let currentGame = null;
let teamA = null;
let teamB = null;
let selectedVoice = localStorage.getItem('selectedVoice') || 'ErXwobaYiN019PkySvjV';

if (!authToken) {
    window.location.href = 'login.html';
}

const urlParams = new URLSearchParams(window.location.search);
const gameId = urlParams.get('id');

if (!gameId) {
    window.location.href = 'dashboard.html';
}

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

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function scoringSlotToTeamName(slot) {
    if (!currentGame) return '';
    return slot === 'team_a' ? currentGame.team_a_name : currentGame.team_b_name;
}

function scoringSlotToTeamColor(slot) {
    if (!currentGame) return '#ccc';
    return slot === 'team_a' ? currentGame.team_a_color : currentGame.team_b_color;
}

async function loadGame() {
    try {
        const response = await apiCall(`/games`, {
            method: 'POST',
            body: JSON.stringify({ _action: 'get', id: parseInt(gameId, 10) })
        });
        if (!response) return;
        if (!response.ok) {
            let msg = 'Error loading game';
            try {
                const err = await response.json();
                msg = err.error || msg;
            } catch (e) {
                msg = `HTTP ${response.status}`;
            }
            showMessage('gameMessage', msg, 'error');
            return;
        }

        currentGame = await response.json();

        const teamsResponse = await apiCall('/teams');
        if (teamsResponse && teamsResponse.ok) {
            const allTeams = await teamsResponse.json();
            teamA = allTeams.find((t) => t.id === currentGame.team_a_id) || null;
            teamB = allTeams.find((t) => t.id === currentGame.team_b_id) || null;
        }

        const scoringSelect = document.getElementById('scoringTeam');
        if (scoringSelect && currentGame) {
            scoringSelect.innerHTML = `
                <option value="team_a">${escapeHtml(currentGame.team_a_name)}</option>
                <option value="team_b">${escapeHtml(currentGame.team_b_name)}</option>`;
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

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

function switchGameTab(tabName) {
    document.querySelectorAll('.tab').forEach((tab) => tab.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

function playersForSlot(slot) {
    return slot === 'team_a' ? teamA && teamA.players : teamB && teamB.players;
}

function renderAttendingPlayers() {
    const container = document.getElementById('attendingPlayersCheckboxes');
    if (!teamA || !teamB) {
        container.innerHTML = '<p style="color: #7f8c8d; padding: 10px;">Could not load team rosters.</p>';
        return;
    }
    const attendingIds = (currentGame.attending_players || []).map((p) => p.id);
    const hasAny = attendingIds.length > 0;
    const defaultAll = !hasAny;

    function block(slot, team) {
        const rawColor = (team.team_color && String(team.team_color).trim()) || '';
        const accent = rawColor.startsWith('#') ? rawColor : '#3498db';
        const teamTitle = escapeHtml(team.team_name);

        if (!team.players || team.players.length === 0) {
            return `
            <div class="attending-team-group" style="--team-accent: ${accent}">
                <div class="attending-team-group__header">
                    <span class="attending-team-group__badge">${teamTitle}</span>
                </div>
                <div class="attending-team-group__list">
                    <p style="color: #7f8c8d; margin: 0;">No players on this roster yet.</p>
                </div>
            </div>`;
        }

        const sorted = [...team.players].sort((a, b) => a.player_number - b.player_number);
        const rows = sorted
            .map((player) => {
                const checked = defaultAll || attendingIds.includes(player.id);
                return `
                <div class="attending-player-row">
                    <input type="checkbox" id="att_${slot}_${player.id}" data-slot="${slot}" value="${player.id}" ${checked ? 'checked' : ''}>
                    <label for="att_${slot}_${player.id}">${escapeHtml(player.player_name)}</label>
                    <span style="color:#95a5a6;font-size:0.9rem;">#</span>
                    <input type="number" id="num_${slot}_${player.id}" value="${player.player_number}" min="1" max="99" title="Jersey for this game" style="width: 56px; padding: 6px 8px; border: 2px solid #94a3b8; border-radius: 6px;">
                </div>`;
            })
            .join('');

        return `
            <div class="attending-team-group" style="--team-accent: ${accent}">
                <div class="attending-team-group__header">
                    <span class="attending-team-group__badge">${teamTitle}</span>
                </div>
                <div class="attending-team-group__list">
                    ${rows}
                </div>
            </div>`;
    }

    container.innerHTML = block('team_a', teamA) + block('team_b', teamB);
}

async function saveAttendingPlayers() {
    try {
        const checkboxes = document.querySelectorAll('#attendingPlayersCheckboxes input[type="checkbox"]:checked');
        const attendingPlayerIds = Array.from(checkboxes).map((cb) => parseInt(cb.value, 10));

        const updates = [];
        ['team_a', 'team_b'].forEach((slot) => {
            const team = slot === 'team_a' ? teamA : teamB;
            if (!team || !team.players) return;
            team.players.forEach((player) => {
                const numEl = document.getElementById(`num_${slot}_${player.id}`);
                if (!numEl) return;
                const inputVal = parseInt(numEl.value, 10);
                if (inputVal !== parseInt(player.player_number, 10)) {
                    updates.push({ teamId: team.id, playerId: player.id, player_number: inputVal });
                }
            });
        });

        for (const u of updates) {
            let response = await apiCall(`/teams/${u.teamId}/players/${u.playerId}`, {
                method: 'PUT',
                body: JSON.stringify({ player_number: u.player_number })
            });
            if (!response || !response.ok) {
                response = await apiCall('/teams/players', {
                    method: 'POST',
                    body: JSON.stringify({
                        _action: 'update',
                        id: u.playerId,
                        player_number: u.player_number
                    })
                });
            }
        }

        if (updates.length > 0) {
            const teamsResponse = await apiCall('/teams');
            if (teamsResponse && teamsResponse.ok) {
                const allTeams = await teamsResponse.json();
                teamA = allTeams.find((t) => t.id === currentGame.team_a_id) || teamA;
                teamB = allTeams.find((t) => t.id === currentGame.team_b_id) || teamB;
            }
            await loadGame();
        }

        let response = await apiCall(`/games/${gameId}`, {
            method: 'POST',
            body: JSON.stringify({
                _action: 'update-attending-players',
                attending_player_ids: attendingPlayerIds
            })
        });
        if (!response || !response.ok) {
            response = await apiCall(`/games`, {
                method: 'POST',
                body: JSON.stringify({
                    _action: 'update-attending-players',
                    id: parseInt(gameId, 10),
                    attending_player_ids: attendingPlayerIds
                })
            });
        }
        if (!response) {
            showMessage('attendingMessage', 'No response from server', 'error');
            return;
        }
        if (response.ok) {
            const updated = await response.json();
            showMessage('attendingMessage', 'Attending players updated', 'success');
            currentGame.attending_players = updated.attending_players || [];
            renderAttendingPlayers();
            updatePlayerDropdowns();
        } else {
            const err = await response.json().catch(() => ({}));
            showMessage('attendingMessage', err.error || 'Error saving', 'error');
        }
    } catch (error) {
        console.error(error);
        showMessage('attendingMessage', `Error: ${error.message}`, 'error');
    }
}

function showMessage(elementId, message, type) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(elementId, message);
        return;
    }
    element.className = type === 'error' ? 'error-message' : 'success-message';
    element.textContent = message;
    element.style.display = 'block';
    setTimeout(() => {
        element.style.display = 'none';
    }, 5000);
}

function renderGameInfo() {
    document.getElementById('gameTitle').textContent = currentGame.game_name || 'Unnamed game';
    document.getElementById('gameInfo').innerHTML = `
        <strong><span style="color:${currentGame.team_a_color}">${escapeHtml(currentGame.team_a_name)}</span>
        vs
        <span style="color:${currentGame.team_b_color}">${escapeHtml(currentGame.team_b_name)}</span></strong>
        · Created ${new Date(currentGame.created_at).toLocaleDateString()}
        · Goals: ${currentGame.goals ? currentGame.goals.length : 0}`;
}

function updatePlayerDropdowns() {
    if (!currentGame || !teamA || !teamB) return;

    const scoringSlot = document.getElementById('scoringTeam').value || 'team_a';
    const scorerSelect = document.getElementById('scorer');
    const assist1Select = document.getElementById('assist1');
    const assist2Select = document.getElementById('assist2');
    if (!scorerSelect || !assist1Select || !assist2Select) return;

    const attending = currentGame.attending_players || [];
    const attendingIdSet = new Set(attending.map((p) => p.id));
    const roster = playersForSlot(scoringSlot) || [];
    const players = roster.filter((p) => attendingIdSet.has(p.id));

    const opt = (p) => {
        const o = document.createElement('option');
        o.value = `${p.id}|${scoringSlot}`;
        o.textContent = `#${p.player_number} ${p.player_name}`;
        return o;
    };

    scorerSelect.innerHTML = '<option value="">Select scorer</option>';
    players.forEach((p) => scorerSelect.appendChild(opt(p)));

    [assist1Select, assist2Select].forEach((sel) => {
        sel.innerHTML = '<option value="">No assist</option>';
        players.forEach((p) => sel.appendChild(opt(p)));
    });
}

function generateAnnouncement(goal) {
    const teamName = scoringSlotToTeamName(goal.scoring_team);
    let announcement = `Goal for the ${teamName}! by number ${goal.scorer_number}, ${goal.scorer_name}`;
    if (goal.assist1_name) {
        announcement += `, assisted by number ${goal.assist1_number}, ${goal.assist1_name}`;
        if (goal.assist2_name) {
            announcement += ` and number ${goal.assist2_number}, ${goal.assist2_name}`;
        }
    } else {
        announcement += ', unassisted';
    }
    const periodText =
        goal.period === 'ot' ? 'overtime' : goal.period === '1' ? 'first' : goal.period === '2' ? 'second' : 'third';
    announcement += `, in the ${periodText} period with ${goal.time_remaining} remaining.`;
    return announcement;
}

function findPlayerOnRoster(playerId, slot) {
    const team = slot === 'team_a' ? teamA : teamB;
    return team && team.players ? team.players.find((p) => p.id === parseInt(playerId, 10)) : null;
}

async function recordGoal(event) {
    event.preventDefault();
    try {
        const scoringSlot = document.getElementById('scoringTeam').value;
        const scorerData = document.getElementById('scorer').value;
        const assist1Data = document.getElementById('assist1').value;
        const assist2Data = document.getElementById('assist2').value;
        const period = document.getElementById('period').value;
        const timeRemaining = document.getElementById('timeRemaining').value;

        if (!scorerData) {
            showMessage('gameMessage', 'Please select a scorer', 'error');
            return;
        }

        const [scorerId, scorerSlot] = scorerData.split('|');
        const assist1 = assist1Data ? assist1Data.split('|') : null;
        const assist2 = assist2Data ? assist2Data.split('|') : null;

        const scorerIsTeamA = scorerSlot === 'team_a';
        const playerS = findPlayerOnRoster(scorerId, scorerSlot);
        let scorerName = playerS ? playerS.player_name : null;
        let scorerNumber = playerS ? playerS.player_number : null;
        if (!scorerName && currentGame.attending_players) {
            const ap = currentGame.attending_players.find((p) => p.id === parseInt(scorerId, 10));
            if (ap) {
                scorerName = ap.player_name;
                scorerNumber = ap.player_number;
            }
        }

        let assist1Name = null,
            assist1Number = null,
            assist2Name = null,
            assist2Number = null;

        if (assist1) {
            const [id, slot] = assist1;
            const pl = findPlayerOnRoster(id, slot);
            if (pl) {
                assist1Name = pl.player_name;
                assist1Number = pl.player_number;
            } else if (currentGame.attending_players) {
                const ap = currentGame.attending_players.find((p) => p.id === parseInt(id, 10));
                if (ap) {
                    assist1Name = ap.player_name;
                    assist1Number = ap.player_number;
                }
            }
        }
        if (assist2) {
            const [id, slot] = assist2;
            const pl = findPlayerOnRoster(id, slot);
            if (pl) {
                assist2Name = pl.player_name;
                assist2Number = pl.player_number;
            } else if (currentGame.attending_players) {
                const ap = currentGame.attending_players.find((p) => p.id === parseInt(id, 10));
                if (ap) {
                    assist2Name = ap.player_name;
                    assist2Number = ap.player_number;
                }
            }
        }

        const announcementData = {
            scoring_team: scoringSlot,
            scorer_name: scorerName,
            scorer_number: scorerNumber,
            assist1_name: assist1Name,
            assist1_number: assist1Number,
            assist2_name: assist2Name,
            assist2_number: assist2Number,
            period,
            time_remaining: timeRemaining
        };
        const announcementText = generateAnnouncement(announcementData);

        const goalData = {
            scoring_team: scoringSlot,
            scorer_player_id: parseInt(scorerId, 10),
            scorer_is_team_a: scorerIsTeamA,
            assist1_player_id: assist1 ? parseInt(assist1[0], 10) : null,
            assist1_is_team_a: assist1 ? assist1[1] === 'team_a' : null,
            assist2_player_id: assist2 ? parseInt(assist2[0], 10) : null,
            assist2_is_team_a: assist2 ? assist2[1] === 'team_a' : null,
            period,
            time_remaining: timeRemaining,
            announcement_text: announcementText
        };

        let response = await apiCall(`/games/${gameId}/goals`, {
            method: 'POST',
            body: JSON.stringify(goalData)
        });
        if (!response || !response.ok) {
            response = await apiCall(`/games`, {
                method: 'POST',
                body: JSON.stringify({
                    _action: 'record-goal',
                    game_id: parseInt(gameId, 10),
                    ...goalData
                })
            });
        }
        if (!response) return;
        if (response.ok) {
            showMessage('gameMessage', 'Goal recorded', 'success');
            document.getElementById('scorer').value = '';
            document.getElementById('assist1').value = '';
            document.getElementById('assist2').value = '';
            document.getElementById('timeRemaining').value = '4:25';
            await loadGame();
        } else {
            const err = await response.json().catch(() => ({}));
            showMessage('gameMessage', err.error || 'Error recording goal', 'error');
        }
    } catch (error) {
        console.error(error);
        showMessage('gameMessage', 'Error recording goal', 'error');
    }
}

async function deleteGoal(goalId) {
    if (!confirm('Delete this goal?')) return;
    const response = await apiCall(`/games/${gameId}/goals/${goalId}`, { method: 'DELETE' });
    if (!response) return;
    if (response.ok) {
        showMessage('gameMessage', 'Goal deleted', 'success');
        await loadGame();
    } else {
        const err = await response.json();
        showMessage('gameMessage', err.error || 'Error deleting goal', 'error');
    }
}

async function playAnnouncement(announcementText) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: announcementText, voice: selectedVoice })
        });
        if (response.ok) {
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.onended = () => URL.revokeObjectURL(audioUrl);
            audio.onerror = () => showMessage('gameMessage', 'Playback error', 'error');
            audio.play();
        } else {
            showMessage('gameMessage', 'TTS error', 'error');
        }
    } catch (e) {
        console.error(e);
        showMessage('gameMessage', 'Error playing announcement', 'error');
    }
}

function renderGoals() {
    const list = document.getElementById('goalsList');
    if (!currentGame.goals || currentGame.goals.length === 0) {
        list.innerHTML = '<p style="color: #7f8c8d; text-align: center; padding: 20px;">No goals yet</p>';
        return;
    }

    list.innerHTML = currentGame.goals
        .map((goal) => {
            const teamMatch = goal.announcement_text && goal.announcement_text.match(/Goal for the (.+?)!/);
            const teamName = teamMatch ? teamMatch[1] : scoringSlotToTeamName(goal.scoring_team);
            const teamColor = scoringSlotToTeamColor(goal.scoring_team);
            const goalId = goal.id;
            const isEditing = window.editingGoalId === goalId;

            if (isEditing) {
                return `
                <div class="goal-item" id="goal_${goalId}">
                    <div class="goal-info" style="flex-direction: column; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 15px; flex-wrap: wrap;">
                            <span class="goal-team" style="background-color: ${teamColor}">${teamName}</span>
                            <span class="goal-time">${goal.period === 'ot' ? 'OT' : `P${goal.period}`} ${goal.time_remaining}</span>
                        </div>
                        <textarea id="edit_announcement_${goalId}" rows="3" style="width: 100%; padding: 10px 12px; border: 2px solid #2563eb; border-radius: 6px; font-size: 0.9375rem; box-sizing: border-box; font-family: inherit;">${goal.announcement_text.replace(/"/g, '&quot;')}</textarea>
                    </div>
                    <div class="goal-actions">
                        <button class="btn btn-primary btn-sm" onclick="saveGoalAnnouncement(${goalId})">Save</button>
                        <button class="btn btn-secondary btn-sm" onclick="cancelEditGoal(${goalId})">Cancel</button>
                    </div>
                </div>`;
            }
            return `
                <div class="goal-item" id="goal_${goalId}">
                    <div class="goal-info">
                        <span class="goal-team" style="background-color: ${teamColor}">${teamName}</span>
                        <span class="goal-scorer">${goal.announcement_text}</span>
                        <span class="goal-time">${goal.period === 'ot' ? 'OT' : `P${goal.period}`} ${goal.time_remaining}</span>
                    </div>
                    <div class="goal-actions">
                        <button class="btn btn-secondary btn-sm" onclick="playAnnouncement('${goal.announcement_text.replace(/'/g, "\\'")}')">Play</button>
                        <button class="btn btn-primary btn-sm" onclick="editGoalAnnouncement(${goalId})">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteGoal(${goalId})">Delete</button>
                    </div>
                </div>`;
        })
        .join('');
}

function editGoalAnnouncement(goalId) {
    window.editingGoalId = goalId;
    renderGoals();
}

function cancelEditGoal() {
    window.editingGoalId = null;
    renderGoals();
}

async function saveGoalAnnouncement(goalId) {
    try {
        const textarea = document.getElementById(`edit_announcement_${goalId}`);
        if (!textarea) return;
        const newText = textarea.value.trim();
        if (!newText) {
            showMessage('gameMessage', 'Announcement cannot be empty', 'error');
            return;
        }
        let response = await apiCall(`/games/${gameId}/goals/${goalId}`, {
            method: 'PUT',
            body: JSON.stringify({ announcement_text: newText })
        });
        if (!response || !response.ok) {
            response = await apiCall(`/games`, {
                method: 'POST',
                body: JSON.stringify({
                    _action: 'update-goal',
                    game_id: parseInt(gameId, 10),
                    goal_id: goalId,
                    announcement_text: newText
                })
            });
        }
        if (response && response.ok) {
            showMessage('gameMessage', 'Updated', 'success');
            window.editingGoalId = null;
            await loadGame();
        } else {
            const err = response ? await response.json().catch(() => ({})) : {};
            showMessage('gameMessage', err.error || 'Error saving', 'error');
        }
    } catch (e) {
        console.error(e);
        showMessage('gameMessage', 'Error saving announcement', 'error');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    loadGame();
    const voiceSelect = document.getElementById('voiceSelect');
    if (voiceSelect) {
        voiceSelect.value = selectedVoice;
        voiceSelect.addEventListener('change', (e) => {
            selectedVoice = e.target.value;
            localStorage.setItem('selectedVoice', selectedVoice);
        });
    }
});
