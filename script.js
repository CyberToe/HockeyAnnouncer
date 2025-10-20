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
        this.speechSynthesis = window.speechSynthesis;
        this.currentVoice = null;
        this.speechRate = 0.9; // Slightly slower for more dramatic effect
        this.speechPitch = 0.8; // Lower pitch for more authoritative sound
        this.speechVolume = 1.0; // Full volume
        this.enhancedMode = true; // Enhanced announcer mode
        
        this.init();
    }

    init() {
        this.setupVoiceOptions();
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

        // Update speech settings
        document.getElementById('speechRate').addEventListener('input', (e) => {
            this.speechRate = parseFloat(e.target.value);
            document.getElementById('rateValue').textContent = this.speechRate.toFixed(1);
        });

        document.getElementById('speechPitch').addEventListener('input', (e) => {
            this.speechPitch = parseFloat(e.target.value);
            document.getElementById('pitchValue').textContent = this.speechPitch.toFixed(1);
        });

        document.getElementById('speechVolume').addEventListener('input', (e) => {
            this.speechVolume = parseFloat(e.target.value);
            document.getElementById('volumeValue').textContent = this.speechVolume.toFixed(1);
        });

        document.getElementById('enhancedMode').addEventListener('change', (e) => {
            this.enhancedMode = e.target.checked;
        });

        document.getElementById('voiceSelect').addEventListener('change', (e) => {
            console.log('Voice selection changed to:', e.target.value);
            
            if (e.target.value === 'default') {
                this.currentVoice = null;
                console.log('Using default voice');
            } else if (e.target.value === 'recommended') {
                // Find the first available male voice (usually better for announcing)
                const voices = this.speechSynthesis.getVoices();
                const maleVoices = voices.filter(voice => 
                    voice.lang.startsWith('en') && 
                    (voice.gender === 'male' || 
                     voice.name.toLowerCase().includes('male') ||
                     voice.name.toLowerCase().includes('david') ||
                     voice.name.toLowerCase().includes('alex') ||
                     voice.name.toLowerCase().includes('daniel'))
                );
                
                this.currentVoice = maleVoices.length > 0 ? maleVoices[0] : voices[0] || null;
                console.log('Using recommended voice:', this.currentVoice?.name);
            } else {
                this.currentVoice = this.speechSynthesis.getVoices().find(voice => voice.name === e.target.value);
                console.log('Using selected voice:', this.currentVoice?.name || 'not found');
            }
            
            // Test the voice immediately
            this.testCurrentVoice();
        });

        // Update team names when changed
        document.getElementById('homeTeamName').addEventListener('input', (e) => {
            this.teams.home.name = e.target.value;
        });

        document.getElementById('awayTeamName').addEventListener('input', (e) => {
            this.teams.away.name = e.target.value;
        });

        // Update team colors
        document.getElementById('homeTeamColor').addEventListener('change', (e) => {
            this.teams.home.color = e.target.value;
            this.updateTeamColors();
        });

        document.getElementById('awayTeamColor').addEventListener('change', (e) => {
            this.teams.away.color = e.target.value;
            this.updateTeamColors();
        });
    }

    setupVoiceOptions() {
        const voiceSelect = document.getElementById('voiceSelect');
        
        // Wait for voices to load
        const loadVoices = () => {
            const voices = this.speechSynthesis.getVoices();
            console.log('Available voices:', voices.map(v => v.name));
            voiceSelect.innerHTML = '';
            
            // Add recommended announcer voices first
            const recommendedOption = document.createElement('option');
            recommendedOption.value = 'recommended';
            recommendedOption.textContent = '🎤 Recommended Announcer Voice';
            voiceSelect.appendChild(recommendedOption);
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = 'default';
            defaultOption.textContent = 'Default Voice';
            voiceSelect.appendChild(defaultOption);
            
            // Add separator
            const separatorOption = document.createElement('option');
            separatorOption.disabled = true;
            separatorOption.textContent = '───────────────';
            separatorOption.textContent = 'Available Voices';
            voiceSelect.appendChild(separatorOption);
            
            // Add all available voices with detailed info
            const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
            
            if (englishVoices.length === 0) {
                const noVoicesOption = document.createElement('option');
                noVoicesOption.disabled = true;
                noVoicesOption.textContent = 'No voices available - using default';
                voiceSelect.appendChild(noVoicesOption);
            } else {
                englishVoices.forEach((voice, index) => {
                    const option = document.createElement('option');
                    option.value = voice.name;
                    option.textContent = `${voice.name} (${voice.lang}) - ${voice.gender || 'Unknown'}`;
                    voiceSelect.appendChild(option);
                });
                
                // Auto-select first available voice
                this.currentVoice = englishVoices[0];
                voiceSelect.value = englishVoices[0].name;
            }
            
            // Add debug info
            console.log('Selected voice:', this.currentVoice?.name || 'default');
        };

        // Force voice loading with multiple attempts
        const attemptLoadVoices = (attempts = 0) => {
            if (attempts < 5) {
                const voices = this.speechSynthesis.getVoices();
                if (voices.length === 0) {
                    setTimeout(() => attemptLoadVoices(attempts + 1), 500);
                } else {
                    loadVoices();
                }
            } else {
                loadVoices(); // Load with empty voices if still none found
            }
        };

        attemptLoadVoices();
    }

    loadSampleData() {
        // Add some sample players if teams are empty
        if (this.teams.home.players.length === 0) {
            this.teams.home.players = [
                { name: 'Sarah Johnson', number: 19 },
                { name: 'Emily Carter', number: 9 },
                { name: 'Jessica Miller', number: 12 },
                { name: 'Amanda Wilson', number: 7 },
                { name: 'Rachel Davis', number: 3 }
            ];
        }

        if (this.teams.away.players.length === 0) {
            this.teams.away.players = [
                { name: 'Alex Thompson', number: 15 },
                { name: 'Jordan Smith', number: 22 },
                { name: 'Taylor Brown', number: 8 },
                { name: 'Casey Jones', number: 14 },
                { name: 'Morgan Lee', number: 6 }
            ];
        }

        this.renderPlayers();
        this.updatePlayerDropdowns();
    }

    addPlayer(team) {
        const nameInput = document.getElementById(`${team}PlayerName`);
        const numberInput = document.getElementById(`${team}PlayerNumber`);
        
        const name = nameInput.value.trim();
        const number = parseInt(numberInput.value);

        if (!name || !number || number < 1 || number > 99) {
            alert('Please enter a valid player name and number (1-99)');
            return;
        }

        // Check if number already exists
        if (this.teams[team].players.some(player => player.number === number)) {
            alert('Player number already exists on this team');
            return;
        }

        this.teams[team].players.push({ name, number });
        this.teams[team].players.sort((a, b) => a.number - b.number);
        
        nameInput.value = '';
        numberInput.value = '';
        
        this.renderPlayers();
        this.updatePlayerDropdowns();
        this.saveGameData();
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
                    <span class="player-info">#${player.number} ${player.name}</span>
                    <button class="delete-btn" onclick="app.deletePlayer('${team}', ${index})">×</button>
                `;
                playersList.appendChild(playerItem);
            });
        });
    }

    updatePlayerDropdowns() {
        const scoringTeam = document.getElementById('scoringTeam').value;
        const teamPlayers = this.teams[scoringTeam].players;
        
        // Update scorer dropdown
        const scorerSelect = document.getElementById('scorer');
        scorerSelect.innerHTML = '<option value="">Select scorer</option>';
        teamPlayers.forEach(player => {
            const option = document.createElement('option');
            option.value = JSON.stringify(player);
            option.textContent = `#${player.number} ${player.name}`;
            scorerSelect.appendChild(option);
        });

        // Update assist dropdowns
        ['assist1', 'assist2'].forEach(assistId => {
            const assistSelect = document.getElementById(assistId);
            assistSelect.innerHTML = '<option value="">No assist</option>';
            teamPlayers.forEach(player => {
                const option = document.createElement('option');
                option.value = JSON.stringify(player);
                option.textContent = `#${player.number} ${player.name}`;
                assistSelect.appendChild(option);
            });
        });
    }

    updateTeamColors() {
        document.documentElement.style.setProperty('--home-color', this.teams.home.color);
        document.documentElement.style.setProperty('--away-color', this.teams.away.color);
    }

    recordGoal() {
        const scoringTeam = document.getElementById('scoringTeam').value;
        const scorer = JSON.parse(document.getElementById('scorer').value || 'null');
        const assist1 = JSON.parse(document.getElementById('assist1').value || 'null');
        const assist2 = JSON.parse(document.getElementById('assist2').value || 'null');
        const period = document.getElementById('period').value;
        const timeRemaining = document.getElementById('timeRemaining').value;

        if (!scorer) {
            alert('Please select a scorer');
            return;
        }

        if (!timeRemaining.match(/^\d{1,2}:\d{2}$/)) {
            alert('Please enter time in MM:SS format');
            return;
        }

        const goal = {
            id: Date.now(),
            timestamp: new Date().toLocaleTimeString(),
            team: scoringTeam,
            teamName: this.teams[scoringTeam].name,
            scorer: scorer,
            assist1: assist1,
            assist2: assist2,
            period: period,
            timeRemaining: timeRemaining
        };

        // Generate announcement after goal object is created
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
        const periodText = goal.period === 'ot' ? 'overtime' : 
                          goal.period === '1' ? 'first period' :
                          goal.period === '2' ? 'second period' :
                          'third period';

        let announcement = `Goal for the ${goal.teamName}! by number ${goal.scorer.number}, ${goal.scorer.name}`;

        if (goal.assist1 && goal.assist2) {
            announcement += `, assisted by number ${goal.assist1.number}, ${goal.assist1.name} and number ${goal.assist2.number}, ${goal.assist2.name}`;
        } else if (goal.assist1) {
            announcement += `, assisted by number ${goal.assist1.number}, ${goal.assist1.name}`;
        } else {
            announcement += ', unassisted';
        }

        announcement += `, in the ${periodText} with ${goal.timeRemaining} remaining.`;

        return announcement;
    }

    announceGoal(goal) {
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }

        // Create a more exciting announcement with pauses and emphasis
        const enhancedAnnouncement = this.createEnhancedAnnouncement(goal.announcement);
        
        const utterance = new SpeechSynthesisUtterance(enhancedAnnouncement);
        
        if (this.currentVoice) {
            utterance.voice = this.currentVoice;
        }
        
        utterance.rate = this.speechRate;
        utterance.pitch = this.speechPitch;
        utterance.volume = this.speechVolume;

        // Add error handling
        utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            alert('Speech synthesis error. Please check your browser settings and ensure audio is enabled.');
        };

        utterance.onstart = () => {
            console.log('Announcement started:', enhancedAnnouncement);
        };

        utterance.onend = () => {
            console.log('Announcement completed');
        };

        this.speechSynthesis.speak(utterance);
    }

    createEnhancedAnnouncement(announcement) {
        if (!this.enhancedMode) {
            return announcement;
        }
        
        // Add excitement and natural pauses to make it sound less robotic
        let enhanced = announcement;
        
        // Add emphasis to "Goal!" and make it more dramatic
        enhanced = enhanced.replace(/Goal for the ([^!]+)!/, 'GOAL FOR THE $1!');
        
        // Add dramatic pauses with periods for better rhythm
        enhanced = enhanced.replace(/by number (\d+), ([^,]+)/, 'by number $1, $2');
        enhanced = enhanced.replace(/assisted by number (\d+), ([^,]+)/, 'assisted by number $1, $2');
        enhanced = enhanced.replace(/in the ([^,]+)/, 'in the $1');
        
        // Make it sound more like a real announcer
        enhanced = enhanced.replace(/with (\d+:\d+) remaining/, 'with $1 remaining!');
        
        return enhanced;
    }

    testVoice() {
        const testMessage = "Goal for the Valkyries! by number 19, Sarah Johnson, assisted by number 9, Emily Carter, in the second period with 4:25 remaining.";
        
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(testMessage);
        
        if (this.currentVoice) {
            utterance.voice = this.currentVoice;
        }
        
        utterance.rate = this.speechRate;
        utterance.pitch = this.speechPitch;
        utterance.volume = this.speechVolume;

        utterance.onerror = (event) => {
            console.error('Test speech synthesis error:', event);
            alert('Speech synthesis error. Please check your browser settings and ensure audio is enabled.');
        };

        utterance.onstart = () => {
            console.log('Test announcement started');
        };

        utterance.onend = () => {
            console.log('Test announcement completed');
        };

        this.speechSynthesis.speak(utterance);
    }

    testCurrentVoice() {
        const testMessage = "Testing voice selection.";
        
        if (this.speechSynthesis.speaking) {
            this.speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(testMessage);
        
        if (this.currentVoice) {
            utterance.voice = this.currentVoice;
        }
        
        utterance.rate = this.speechRate;
        utterance.pitch = this.speechPitch;
        utterance.volume = this.speechVolume;

        utterance.onstart = () => {
            console.log('Voice test started with:', this.currentVoice?.name || 'default');
        };

        utterance.onend = () => {
            console.log('Voice test completed');
        };

        utterance.onerror = (event) => {
            console.error('Voice test error:', event);
        };

        this.speechSynthesis.speak(utterance);
    }

    testMultipleVoices() {
        const voices = this.speechSynthesis.getVoices().filter(voice => voice.lang.startsWith('en'));
        let currentIndex = 0;
        
        const testMessage = "Goal for the Valkyries! by number 19, Sarah Johnson, assisted by number 9, Emily Carter, in the second period with 4:25 remaining.";
        
        const playNextVoice = () => {
            if (currentIndex < voices.length) {
                const voice = voices[currentIndex];
                console.log(`Testing voice: ${voice.name}`);
                
                if (this.speechSynthesis.speaking) {
                    this.speechSynthesis.cancel();
                }

                const utterance = new SpeechSynthesisUtterance(testMessage);
                utterance.voice = voice;
                utterance.rate = this.speechRate;
                utterance.pitch = this.speechPitch;
                utterance.volume = this.speechVolume;

                utterance.onend = () => {
                    console.log(`Finished testing: ${voice.name}`);
                    currentIndex++;
                    // Wait 1 second between voices
                    setTimeout(playNextVoice, 1000);
                };

                utterance.onerror = (event) => {
                    console.error(`Error with voice ${voice.name}:`, event);
                    currentIndex++;
                    setTimeout(playNextVoice, 1000);
                };

                this.speechSynthesis.speak(utterance);
            } else {
                console.log('Finished testing all voices');
                alert('Voice testing complete! Check the console for details about each voice.');
            }
        };

        alert(`Starting to test ${voices.length} English voices. Check the console for details.`);
        playNextVoice();
    }

    debugVoices() {
        const voices = this.speechSynthesis.getVoices();
        console.log('=== VOICE DEBUG INFO ===');
        console.log('Total voices available:', voices.length);
        console.log('Current selected voice:', this.currentVoice?.name || 'default');
        console.log('Speech synthesis supported:', !!this.speechSynthesis);
        console.log('Browser:', navigator.userAgent);
        
        console.log('\n=== ALL AVAILABLE VOICES ===');
        voices.forEach((voice, index) => {
            console.log(`${index + 1}. ${voice.name}`);
            console.log(`   Language: ${voice.lang}`);
            console.log(`   Gender: ${voice.gender || 'Unknown'}`);
            console.log(`   Local Service: ${voice.localService || 'Unknown'}`);
            console.log(`   Default: ${voice.default || false}`);
        });
        
        const englishVoices = voices.filter(v => v.lang.startsWith('en'));
        console.log('\n=== ENGLISH VOICES ===');
        englishVoices.forEach((voice, index) => {
            console.log(`${index + 1}. ${voice.name} (${voice.gender || 'Unknown'})`);
        });
        
        alert(`Voice debug info logged to console. Found ${voices.length} total voices, ${englishVoices.length} English voices.`);
    }

    renderGoalLog() {
        const goalLogList = document.getElementById('goalLogList');
        goalLogList.innerHTML = '';

        this.goals.forEach((goal, index) => {
            const goalItem = document.createElement('div');
            goalItem.className = `goal-item ${index === this.goals.length - 1 ? 'new-goal' : ''}`;
            
            const teamColor = this.teams[goal.team].color;
            const periodText = goal.period === 'ot' ? 'OT' : 
                              goal.period === '1' ? '1st' :
                              goal.period === '2' ? '2nd' : '3rd';

            goalItem.innerHTML = `
                <div class="goal-header">
                    <div class="goal-time">${goal.timestamp}</div>
                    <div class="goal-team" style="background-color: ${teamColor}">
                        ${goal.teamName} - ${periodText} Period
                    </div>
                </div>
                <div class="goal-details">
                    <strong>Goal:</strong> #${goal.scorer.number} ${goal.scorer.name}<br>
                    ${goal.assist1 ? `<strong>Assists:</strong> #${goal.assist1.number} ${goal.assist1.name}${goal.assist2 ? `, #${goal.assist2.number} ${goal.assist2.name}` : ''}` : '<strong>Unassisted</strong>'}<br>
                    <strong>Time:</strong> ${goal.timeRemaining} remaining
                </div>
                <div class="goal-announcement">
                    ${goal.announcement}
                </div>
                <div class="goal-actions">
                    <button class="btn btn-primary" onclick="app.announceGoal(${JSON.stringify(goal).replace(/"/g, '&quot;')})">
                        🔊 Play Announcement
                    </button>
                    <button class="btn btn-danger" onclick="app.deleteGoal(${goal.id})">
                        🗑️ Delete
                    </button>
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

        let index = 0;
        const playNext = () => {
            if (index < this.goals.length) {
                this.announceGoal(this.goals[index]);
                index++;
                
                // Wait for current announcement to finish
                setTimeout(playNext, 3000);
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
        if (confirm('Are you sure you want to clear all data (teams, players, and goals)?')) {
            this.teams.home.players = [];
            this.teams.away.players = [];
            this.goals = [];
            this.renderPlayers();
            this.renderGoalLog();
            this.updatePlayerDropdowns();
            localStorage.removeItem('hockeyAnnouncerData');
        }
    }

    saveGameData() {
        const gameData = {
            teams: this.teams,
            goals: this.goals,
            timestamp: new Date().toISOString()
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
                
                // Update UI with loaded data
                document.getElementById('homeTeamName').value = this.teams.home.name;
                document.getElementById('awayTeamName').value = this.teams.away.name;
                document.getElementById('homeTeamColor').value = this.teams.home.color;
                document.getElementById('awayTeamColor').value = this.teams.away.color;
                
                this.renderPlayers();
                this.renderGoalLog();
                this.updatePlayerDropdowns();
                this.updateTeamColors();
            } catch (error) {
                console.error('Error loading game data:', error);
            }
        }
    }
}

// Global functions for HTML onclick handlers
function addPlayer(team) {
    app.addPlayer(team);
}

function recordGoal() {
    app.recordGoal();
}

function playAllAnnouncements() {
    app.playAllAnnouncements();
}

function clearGoalLog() {
    app.clearGoalLog();
}

function saveGameData() {
    app.saveGameData();
    alert('Game data saved successfully!');
}

function loadGameData() {
    app.loadGameData();
    alert('Game data loaded successfully!');
}

function clearAllData() {
    app.clearAllData();
}

function testVoice() {
    app.testVoice();
}

function testMultipleVoices() {
    app.testMultipleVoices();
}

function debugVoices() {
    app.debugVoices();
}

// Initialize the application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new HockeyGoalAnnouncer();
});
