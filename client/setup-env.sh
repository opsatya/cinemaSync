#!/bin/bash

# CinemaSync Client Environment Setup Script
# This script helps you set up the necessary environment variables

echo "🔧 Setting up CinemaSync Client Environment Variables..."

# Create .env.local file
cat > .env.local << EOF
# CinemaSync Client Environment Variables
# API Configuration
VITE_API_BASE_URL=http://127.0.0.1:5000/api

# Debug Configuration
VITE_DEBUG_LOGS=true

# Firebase Configuration (REQUIRED - Get these from your Firebase Console)
# Go to: https://console.firebase.google.com/ -> Your Project -> Project Settings -> General -> Your apps
# VITE_FIREBASE_API_KEY=your_api_key_here
# VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
# VITE_FIREBASE_PROJECT_ID=your_project_id
# VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
# VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
# VITE_FIREBASE_APP_ID=your_app_id
# VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
EOF

echo "✅ Created .env.local file with default configuration"
echo ""
echo "📋 Current configuration:"
echo "   API Base URL: http://127.0.0.1:5000/api"
echo "   Debug Logs: Enabled"
echo "   Firebase Config: Using demo values (⚠️ REQUIRES SETUP)"
echo ""
echo "🔥 IMPORTANT: Firebase Configuration Required!"
echo "   1. Go to https://console.firebase.google.com/"
echo "   2. Select your project (or create a new one)"
echo "   3. Go to Project Settings -> General -> Your apps"
echo "   4. Copy the config values to .env.local file"
echo "   5. Uncomment and fill in the Firebase variables"
echo ""
echo "🚀 To start the development server:"
echo "   npm run dev"
echo ""
echo "🔍 To debug authentication issues:"
echo "   1. Open browser DevTools (F12)"
echo "   2. Go to Console tab"
echo "   3. Look for logs starting with 🔍, 🚀, 📬, ✅, or ❌"
echo ""
echo "📝 Edit .env.local file to configure your Firebase project"
