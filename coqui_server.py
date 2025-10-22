#!/usr/bin/env python3
"""
Coqui TTS Server for Hockey Goal Announcer
A simple Flask server that provides high-quality TTS using Coqui TTS
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import tempfile
import os
import logging
from TTS.api import TTS

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for web app integration

# Initialize TTS model
logger.info("Loading Coqui TTS model...")
try:
    # Use a high-quality English model suitable for sports announcing
    tts = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", progress_bar=False)
    logger.info("TTS model loaded successfully!")
except Exception as e:
    logger.error(f"Failed to load TTS model: {e}")
    tts = None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'tts_loaded': tts is not None
    })

@app.route('/tts', methods=['POST'])
def text_to_speech():
    """Convert text to speech using Coqui TTS"""
    if not tts:
        return jsonify({'error': 'TTS model not loaded'}), 500
    
    try:
        data = request.get_json()
        text = data.get('text', '')
        voice = data.get('voice', 'default')
        speed = float(data.get('speed', 1.0))
        pitch = float(data.get('pitch', 1.0))
        
        if not text:
            return jsonify({'error': 'No text provided'}), 400
        
        # Create temporary file for audio output
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # Generate speech
            logger.info(f"Generating speech for: {text[:50]}...")
            tts.tts_to_file(text=text, file_path=temp_path)
            
            # Return the audio file
            return send_file(
                temp_path,
                mimetype='audio/wav',
                as_attachment=True,
                download_name='announcement.wav'
            )
            
        except Exception as e:
            logger.error(f"TTS generation failed: {e}")
            return jsonify({'error': 'TTS generation failed'}), 500
            
        finally:
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    except Exception as e:
        logger.error(f"Request processing failed: {e}")
        return jsonify({'error': 'Request processing failed'}), 500

@app.route('/voices', methods=['GET'])
def get_voices():
    """Get available voices"""
    return jsonify({
        'voices': [
            {'id': 'default', 'name': 'Default Sports Announcer', 'language': 'en'},
            {'id': 'male_sports_announcer', 'name': 'Male Sports Announcer', 'language': 'en'},
            {'id': 'female_announcer', 'name': 'Female Announcer', 'language': 'en'}
        ]
    })

if __name__ == '__main__':
    logger.info("Starting Coqui TTS Server...")
    logger.info("Server will be available at: http://localhost:5000")
    logger.info("Health check: http://localhost:5000/health")
    logger.info("TTS endpoint: http://localhost:5000/tts")
    
    app.run(host='0.0.0.0', port=5000, debug=False)
