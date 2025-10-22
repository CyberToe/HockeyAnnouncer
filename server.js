const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());

// Parse JSON requests
app.use(express.json());

// Serve static files from the current directory
app.use(express.static('.'));

// API endpoint for TTS (simulates Vercel serverless function)
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice = 'David', speed = 1.0, pitch = 1.0 } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`TTS Request: "${text.substring(0, 50)}..." with voice: ${voice}`);

    // Use ElevenLabs API for high-quality AI voices
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voice, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY || 'sk_7814e138ef3ee3a105196c9fa9690958aac786cc4332251b'
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    // Get the audio data
    const audioBuffer = await response.arrayBuffer();
    
    // Return the audio file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="announcement.mp3"');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('TTS API Error:', error);
    res.status(500).json({ 
      error: 'TTS generation failed',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    tts_available: true
  });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log('🏒 Hockey Goal Announcer Server');
  console.log('================================');
  console.log(`🚀 Server running at: http://localhost:${PORT}`);
  console.log(`🎤 TTS API available at: http://localhost:${PORT}/api/tts`);
  console.log(`❤️  Health check: http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('📋 Available TTS modes:');
  console.log('   • Browser TTS (Free, Limited Quality)');
  console.log('   • Cloud TTS (Better Quality, Requires Internet)');
  console.log('   • Vercel Serverless TTS (Professional Quality)');
  console.log('   • Coqui TTS (Best Quality, Requires Local Server)');
  console.log('');
  console.log('💡 To test Coqui TTS:');
  console.log('   1. Run: npm run setup-coqui');
  console.log('   2. Run: npm run coqui');
  console.log('   3. Select "Coqui TTS" mode in the app');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Hockey Goal Announcer server...');
  process.exit(0);
});
