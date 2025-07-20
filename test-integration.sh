#!/bin/bash

echo "Signal/Noise Ratio Integration Test"
echo "==================================="
echo ""

# Check if server is running
echo "1. Checking if server is running..."
if curl -s http://localhost:3001/health > /dev/null; then
    echo "✓ Server is running"
    curl -s http://localhost:3001/health | jq .
else
    echo "✗ Server is not running. Start it with: cd server && npm start"
    exit 1
fi

echo ""
echo "2. Testing tweet analysis with preferences..."

# Test tweet with user preferences
curl -s -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Just published my research on quantum computing applications in healthcare. Link to paper: example.com/paper",
    "interests": ["quantum computing", "healthcare", "research"],
    "signalPatterns": ["research", "published", "paper"],
    "noisePatterns": ["clickbait", "BREAKING"],
    "threshold": 25
  }' | jq .

echo ""
echo "3. Testing noise detection..."

# Test noise tweet
curl -s -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "BREAKING: You won't BELIEVE what this celebrity just did!!!",
    "interests": ["technology", "science"],
    "signalPatterns": ["research", "data", "analysis"],
    "noisePatterns": ["BREAKING", "clickbait", "celebrity"],
    "threshold": 30
  }' | jq .

echo ""
echo "Test complete!"