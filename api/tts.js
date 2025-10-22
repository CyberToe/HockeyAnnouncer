// Vercel Serverless Function for TTS
// This function can be deployed on Vercel and provides high-quality TTS

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
    const { text, voice = 'David', speed = 1.0, pitch = 1.0 } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Use VoiceRSS API (free tier available)
    const response = await fetch('https://api.voicerss.org/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        key: process.env.VOICERSS_API_KEY || 'demo', // Use demo key if no API key
        src: text,
        hl: 'en-us',
        v: voice,
        r: speed.toString(),
        c: 'MP3',
        f: '44khz_16bit_stereo',
        ssml: 'false'
      })
    });

    if (!response.ok) {
      throw new Error(`VoiceRSS API error: ${response.status}`);
    }

    // Get the audio data
    const audioBuffer = await response.arrayBuffer();
    
    // Return the audio file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="announcement.mp3"');
    res.status(200).send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('TTS API Error:', error);
    res.status(500).json({ error: 'TTS generation failed' });
  }
}
