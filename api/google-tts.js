// Vercel Serverless Function for Google Cloud TTS
// Higher quality TTS using Google Cloud Text-to-Speech API

import { TextToSpeechClient } from '@google-cloud/text-to-speech';

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
    const { text, voice = 'en-US-Standard-D', speed = 1.0, pitch = 0 } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    // Initialize Google Cloud TTS client
    const client = new TextToSpeechClient({
      credentials: JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS || '{}')
    });

    // Configure the request
    const request = {
      input: { text: text },
      voice: {
        languageCode: 'en-US',
        name: voice,
        ssmlGender: 'MALE'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: speed,
        pitch: pitch
      }
    };

    // Generate speech
    const [response] = await client.synthesizeSpeech(request);
    
    // Return the audio file
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="announcement.mp3"');
    res.status(200).send(response.audioContent);

  } catch (error) {
    console.error('Google TTS API Error:', error);
    res.status(500).json({ error: 'TTS generation failed' });
  }
}
