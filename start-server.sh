#!/bin/bash

# Start script for Signal/Noise Ratio local LLM server

echo "Signal/Noise Ratio Local LLM Server"
echo "==================================="
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed!"
    echo "Install it with: brew install ollama"
    exit 1
fi

# Check if Ollama service is running
if ! pgrep -x "ollama" > /dev/null; then
    echo "Starting Ollama service..."
    brew services start ollama
    sleep 2
fi

# Check for installed models
echo "Checking installed models..."
models=$(ollama list | tail -n +2)
if [ -z "$models" ]; then
    echo "No models installed. Installing llama3.2:1b..."
    ollama pull llama3.2:1b
else
    echo "Available models:"
    echo "$models"
fi

# Navigate to server directory
cd server

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing server dependencies..."
    npm install
fi

# Start the server
echo ""
echo "Starting Signal/Noise server on http://localhost:3001"
echo "Press Ctrl+C to stop"
echo ""
npm start