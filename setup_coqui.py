#!/usr/bin/env python3
"""
Setup script for Coqui TTS Server
This script helps set up the Coqui TTS server for the Hockey Goal Announcer
"""

import subprocess
import sys
import os

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n{description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed: {e}")
        print(f"Error output: {e.stderr}")
        return False

def main():
    print("🏒 Setting up Coqui TTS Server for Hockey Goal Announcer")
    print("=" * 60)
    
    # Check Python version
    python_version = sys.version_info
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 8):
        print("❌ Python 3.8 or higher is required")
        sys.exit(1)
    
    print(f"✅ Python {python_version.major}.{python_version.minor}.{python_version.micro} detected")
    
    # Install requirements
    if not run_command("pip install -r requirements.txt", "Installing Python dependencies"):
        print("\n❌ Failed to install dependencies. Please check your Python environment.")
        print("\nManual installation:")
        print("pip install TTS Flask Flask-CORS librosa soundfile")
        sys.exit(1)
    
    # Test TTS import
    print("\n🔍 Testing TTS installation...")
    try:
        from TTS.api import TTS
        print("✅ TTS library imported successfully")
    except ImportError as e:
        print(f"❌ TTS library import failed: {e}")
        print("Please install TTS manually: pip install TTS")
        sys.exit(1)
    
    # Create startup script
    startup_script = """#!/bin/bash
# Hockey Goal Announcer - Coqui TTS Server Startup Script

echo "🏒 Starting Coqui TTS Server for Hockey Goal Announcer..."
echo "Server will be available at: http://localhost:5000"
echo "Press Ctrl+C to stop the server"
echo ""

python3 coqui_server.py
"""
    
    with open('start_coqui_server.sh', 'w') as f:
        f.write(startup_script)
    
    # Make startup script executable on Unix systems
    if os.name != 'nt':  # Not Windows
        os.chmod('start_coqui_server.sh', 0o755)
    
    print("\n🎉 Setup completed successfully!")
    print("\n📋 Next steps:")
    print("1. Start the Coqui TTS server:")
    print("   python3 coqui_server.py")
    print("   OR on Unix/Mac: ./start_coqui_server.sh")
    print("\n2. Open your Hockey Goal Announcer web app")
    print("3. Select 'Coqui TTS (Professional Quality)' in voice settings")
    print("4. Set server URL to: http://localhost:5000")
    print("5. Test the voice with the 'Test Voice' button")
    
    print("\n💡 Tips:")
    print("- The server will download TTS models on first run (may take a few minutes)")
    print("- For best performance, use a machine with GPU support")
    print("- The server will automatically fall back to browser TTS if unavailable")
    
    print("\n🔧 Troubleshooting:")
    print("- If you get import errors, try: pip install --upgrade TTS")
    print("- For GPU support, install PyTorch with CUDA")
    print("- Check the server logs for detailed error messages")

if __name__ == "__main__":
    main()
