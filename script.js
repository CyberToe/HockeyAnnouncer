// Hockey Goal Announcer Application
class HockeyGoalAnnouncer {
    constructor() {
        this.teams = {
            home: {
                name: 'Valkyries',
                color: '#ff6b6b',
                players: []
            },
            away: {
                name: 'Rockets',
                color: '#4ecdc4',
                players: []
            }
        };
        
        this.goals = [];
        this.apiKey = 'sk_7814e138ef3ee3a105196c9fa9690958aac786cc4332251b'; // ElevenLabs API key
        this.selectedVoice = 'ErXwobaYiN019PkySvjV'; // Antoni (Male, American) - good for sports announcing
        
        this.init();
    }

    init() {
        this.loadSampleData();
        this.updatePlayerDropdowns();
        this.loadGameData();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Update player dropdowns when team changes
        document.getElementById('scoringTeam').addEventListener('change', () => {
            this.updatePlayerDropdowns();
        });

        // Voice selection
        document.getElementById('cloudVoiceSelect').addEventListener('change', (e) => {
            this.selectedVoice = e.target.value;
            this.saveGameData();
        });

        // Update team names when changed
        document.getElementById('homeTeamName').addEventListener('input', (e) => {
            this.teams.home.name = e.target.value;
            this.saveGameData();
        });

        document.getElementById('awayTeamName').addEventListener('input', (e) => {
            this.teams.away.name = e.target.value;
            this.saveGameData();
        });

        // Update team colors when changed
        document.getElementById('homeTeamColor').addEventListener('change', (e) => {
            this.teams.home.color = e.target.value;
            this.updateTeamColors();
        });

        document.getElementById('awayTeamColor').addEventListener('change', (e) => {
            this.teams.away.color = e.target.value;
            this.updateTeamColors();
        });
    }

    loadSampleData() {
        // Add some sample players
        this.teams.home.players = [
            { name: 'Amanda Wilson', number: 7 },
            { name: 'Sarah Johnson', number: 19 },
            { name: 'Emily Carter', number: 9 }
        ];

        this.teams.away.players = [
            { name: 'Jessica Brown', number: 12 },
            { name: 'Maria Garcia', number: 23 },
            { name: 'Lisa Anderson', number: 5 }
        ];

        this.renderPlayers();
        this.updatePlayerDropdowns();
    }

    addPlayer(team) {
        const nameInput = document.getElementById(`${team}PlayerName`);
        const numberInput = document.getElementById(`${team}PlayerNumber`);
        
        const name = nameInput.value.trim();
        const number = parseInt(numberInput.value);
        
        if (name && number && number >= 1 && number <= 99) {
            this.teams[team].players.push({ name, number });
            nameInput.value = '';
            numberInput.value = '';
            this.renderPlayers();
            this.updatePlayerDropdowns();
            this.saveGameData();
        } else {
            alert('Please enter a valid name and number (1-99)');
        }
    }

    deletePlayer(team, playerIndex) {
        this.teams[team].players.splice(playerIndex, 1);
        this.renderPlayers();
        this.updatePlayerDropdowns();
        this.saveGameData();
    }

    renderPlayers() {
        ['home', 'away'].forEach(team => {
            const playersList = document.getElementById(`${team}PlayersList`);
            playersList.innerHTML = '';
            
            this.teams[team].players.forEach((player, index) => {
                const playerItem = document.createElement('div');
                playerItem.className = 'player-item';
                playerItem.innerHTML = `
                    <span>#${player.number} ${player.name}</span>
                    <button onclick="app.deletePlayer('${team}', ${index})" class="btn btn-danger btn-sm">Delete</button>
                `;
                playersList.appendChild(playerItem);
            });
        });
    }

    updatePlayerDropdowns() {
        const scorerSelect = document.getElementById('scorer');
        const assist1Select = document.getElementById('assist1');
        const assist2Select = document.getElementById('assist2');
        
        const scoringTeam = document.getElementById('scoringTeam').value;
        const players = this.teams[scoringTeam].players;
        
        [scorerSelect, assist1Select, assist2Select].forEach(select => {
            select.innerHTML = select === scorerSelect ? '<option value="">Select scorer</option>' : '<option value="">No assist</option>';
            
            players.forEach(player => {
                const option = document.createElement('option');
                option.value = `${player.name}|${player.number}`;
                option.textContent = `#${player.number} ${player.name}`;
                select.appendChild(option);
            });
        });
    }

    updateTeamColors() {
        document.documentElement.style.setProperty('--home-color', this.teams.home.color);
        document.documentElement.style.setProperty('--away-color', this.teams.away.color);
    }

    recordGoal() {
        const scoringTeam = document.getElementById('scoringTeam').value;
        const scorerData = document.getElementById('scorer').value;
        const assist1Data = document.getElementById('assist1').value;
        const assist2Data = document.getElementById('assist2').value;
        const period = document.getElementById('period').value;
        const timeRemaining = document.getElementById('timeRemaining').value;
        
        if (!scorerData) {
            alert('Please select a scorer');
            return;
        }
        
        const [scorerName, scorerNumber] = scorerData.split('|');
        const assist1 = assist1Data ? assist1Data.split('|')[0] : null;
        const assist2 = assist2Data ? assist2Data.split('|')[0] : null;
        
        const goal = {
            id: Date.now(),
            team: scoringTeam,
            teamName: this.teams[scoringTeam].name,
            scorer: scorerName,
            scorerNumber: scorerNumber,
            assist1: assist1,
            assist2: assist2,
            period: period,
            timeRemaining: timeRemaining,
            timestamp: new Date().toLocaleTimeString()
        };
        
        goal.announcement = this.generateAnnouncement(goal);
        this.goals.push(goal);
        
        this.renderGoalLog();
        this.announceGoal(goal);
        this.saveGameData();
        
        // Reset form
        document.getElementById('scorer').value = '';
        document.getElementById('assist1').value = '';
        document.getElementById('assist2').value = '';
        document.getElementById('timeRemaining').value = '4:25';
    }

    generateAnnouncement(goal) {
        let announcement = `Goal for the ${goal.teamName}! by number ${goal.scorerNumber}, ${goal.scorer}`;
        
        if (goal.assist1) {
            announcement += `, assisted by ${goal.assist1}`;
            if (goal.assist2) {
                announcement += ` and ${goal.assist2}`;
            }
        }
        
        announcement += `, in the ${goal.period === 'ot' ? 'overtime' : goal.period + (goal.period === '1' ? 'st' : goal.period === '2' ? 'nd' : 'rd') + ' period'} with ${goal.timeRemaining} remaining.`;

        return announcement;
    }

    announceGoal(goal) {
        const announcement = goal.announcement || this.generateAnnouncement(goal);
        
        console.log('Announcing goal:', announcement);
        
        // Always use ElevenLabs TTS
        this.useCloudTTSAnnouncement(announcement);
    }

    async useCloudTTSAnnouncement(announcement) {
        try {
            console.log('Using ElevenLabs TTS for announcement');
            
            const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + this.selectedVoice, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': this.apiKey
                },
                body: JSON.stringify({
                    text: announcement,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.0,
                        use_speaker_boost: true
                    }
                })
            });

            if (response.ok) {
                const audioBlob = await response.blob();
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    console.log('Cloud announcement completed');
                };
                
                audio.onerror = (event) => {
                    console.error('Cloud TTS audio error:', event);
                    alert('Error playing announcement. Please check your internet connection.');
                };
                
                audio.play();
            } else {
                throw new Error('ElevenLabs API service unavailable');
            }
        } catch (error) {
            console.error('ElevenLabs TTS error:', error);
            alert('Error with voice announcement. Please check your internet connection and API key.');
        }
    }

    testVoice() {
        const testMessage = "Goal for the Valkyries! by number 19, Sarah Johnson, assisted by number 9, Emily Carter, in the second period with 4:25 remaining.";
        
        console.log('Testing ElevenLabs voice');
        
        // Always use ElevenLabs TTS
        this.useCloudTTSAnnouncement(testMessage);
    }

    renderGoalLog() {
        const goalLogList = document.getElementById('goalLogList');
        goalLogList.innerHTML = '';
        
        this.goals.forEach(goal => {
            const goalItem = document.createElement('div');
            goalItem.className = 'goal-item';
            goalItem.innerHTML = `
                <div class="goal-info">
                    <span class="goal-team ${goal.team}">${goal.teamName}</span>
                    <span class="goal-scorer">#${goal.scorerNumber} ${goal.scorer}</span>
                    ${goal.assist1 ? `<span class="goal-assist">A: ${goal.assist1}${goal.assist2 ? `, ${goal.assist2}` : ''}</span>` : ''}
                    <span class="goal-time">${goal.period === 'ot' ? 'OT' : `P${goal.period}`} ${goal.timeRemaining}</span>
                    <span class="goal-timestamp">${goal.timestamp}</span>
                </div>
                <div class="goal-actions">
                    <button onclick="app.announceGoal(app.goals.find(g => g.id === ${goal.id}))" class="btn btn-secondary btn-sm">Replay</button>
                    <button onclick="app.deleteGoal(${goal.id})" class="btn btn-danger btn-sm">Delete</button>
                </div>
            `;
            goalLogList.appendChild(goalItem);
        });
    }

    deleteGoal(goalId) {
        this.goals = this.goals.filter(goal => goal.id !== goalId);
        this.renderGoalLog();
        this.saveGameData();
    }

    playAllAnnouncements() {
        if (this.goals.length === 0) {
            alert('No goals to announce');
            return;
        }
        
        let currentIndex = 0;
        const playNext = () => {
            if (currentIndex < this.goals.length) {
                const goal = this.goals[currentIndex];
                console.log(`Playing announcement ${currentIndex + 1} of ${this.goals.length}`);
                
                this.announceGoal(goal);
                currentIndex++;
                
                // Wait for the announcement to finish before playing the next one
                setTimeout(playNext, 4000); // Adjust timing as needed
            }
        };

        playNext();
    }

    clearGoalLog() {
        if (confirm('Are you sure you want to clear all goals?')) {
            this.goals = [];
            this.renderGoalLog();
            this.saveGameData();
        }
    }

    clearAllData() {
        if (confirm('Are you sure you want to clear all data? This will reset teams, players, and goals.')) {
            this.teams.home.players = [];
            this.teams.away.players = [];
            this.goals = [];
            this.renderPlayers();
            this.renderGoalLog();
            this.saveGameData();
            localStorage.removeItem('hockeyAnnouncerData');
        }
    }

    saveGameData() {
        const gameData = {
            teams: this.teams,
            goals: this.goals,
            selectedVoice: this.selectedVoice,
            apiKey: this.apiKey
        };
        
        localStorage.setItem('hockeyAnnouncerData', JSON.stringify(gameData));
    }

    loadGameData() {
        const savedData = localStorage.getItem('hockeyAnnouncerData');
        if (savedData) {
            try {
                const gameData = JSON.parse(savedData);
                this.teams = gameData.teams || this.teams;
                this.goals = gameData.goals || [];
                this.selectedVoice = gameData.selectedVoice || this.selectedVoice;
                this.apiKey = gameData.apiKey || this.apiKey;
                
                // Update UI elements
                document.getElementById('homeTeamName').value = this.teams.home.name;
                document.getElementById('awayTeamName').value = this.teams.away.name;
                document.getElementById('homeTeamColor').value = this.teams.home.color;
                document.getElementById('awayTeamColor').value = this.teams.away.color;
                document.getElementById('cloudVoiceSelect').value = this.selectedVoice;
                
                this.renderPlayers();
                this.renderGoalLog();
                this.updateTeamColors();
            } catch (error) {
                console.error('Error loading saved data:', error);
            }
        }
    }
}

// Initialize the application
const app = new HockeyGoalAnnouncer();

// Global functions for HTML onclick events
function addPlayer(team) {
    app.addPlayer(team);
}

function recordGoal() {
    app.recordGoal();
}

function testVoice() {
    app.testVoice();
}

function playAllAnnouncements() {
    app.playAllAnnouncements();
}

function clearGoalLog() {
    app.clearGoalLog();
}

function clearAllData() {
    app.clearAllData();
}

function saveGameData() {
    app.saveGameData();
}

function loadGameData() {
    app.loadGameData();
}