// Vercel Serverless Function for TTS using ElevenLabs
// This function provides high-quality AI voices through ElevenLabs API

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, voice = 'ErXwobaYiN019PkySvjV' } = req.body; // Default to Antoni

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log(`TTS Request: "${text.substring(0, 50)}..." with voice: ${voice}`);

    // Use ElevenLabs API for high-quality AI voices
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voice, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.HA_ELEVENLABS_API_KEY || 'sk_11b0f83e527f39ff6a23020ae9b9246fee3dce41003c7140' // User's API key
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_turbo_v2_5',
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

    const audioBuffer = await response.arrayBuffer();
    
    // Return the audio file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="announcement.mp3"');
    res.status(200).send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('TTS API Error:', error);
    res.status(500).json({ 
      error: 'TTS generation failed',
      details: error.message 
    });
  }
}