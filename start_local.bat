@echo off
echo 🏒 Hockey Goal Announcer - Local Development Setup
echo ================================================

echo.
echo 📦 Installing Node.js dependencies...
call npm install

echo.
echo 🚀 Starting local development server...
echo.
echo The app will be available at: http://localhost:3000
echo.
echo Available TTS modes:
echo   • Browser TTS (Free, Limited Quality)
echo   • Cloud TTS (Better Quality, Requires Internet)  
echo   • Vercel Serverless TTS (Professional Quality)
echo   • Coqui TTS (Best Quality, Requires Local Server)
echo.
echo Press Ctrl+C to stop the server
echo.

call npm start
