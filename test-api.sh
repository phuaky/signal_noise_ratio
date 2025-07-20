#!/bin/bash

echo "Testing Signal/Noise API"
echo "======================="
echo ""

# Test 1: Signal tweet with interests
echo "Test 1: Signal tweet with AI interests"
curl -s -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "New research paper on transformer architectures improving LLM efficiency by 40%",
    "interests": ["AI", "machine learning", "research"],
    "signalPatterns": ["research", "paper", "efficiency"],
    "threshold": 30
  }' | jq .

echo ""

# Test 2: Noise tweet
echo "Test 2: Noise tweet"
curl -s -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "You will NOT believe what happened next! This is INSANE!",
    "noisePatterns": ["believe", "INSANE", "clickbait"],
    "threshold": 30
  }' | jq .

echo ""

# Test 3: Custom threshold
echo "Test 3: High threshold (strict)"
curl -s -X POST http://localhost:3001/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Quick tip: Use git stash to save work temporarily",
    "interests": ["programming", "git"],
    "threshold": 10
  }' | jq .