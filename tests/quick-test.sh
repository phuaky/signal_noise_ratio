#!/bin/bash

echo "Quick Test for Signal/Noise Ratio Extension"
echo "==========================================="
echo ""

# Check if Ollama is installed
if command -v ollama &> /dev/null; then
    echo "✓ Ollama is installed"
    
    # Check if Ollama service is running
    if pgrep -x "ollama" > /dev/null; then
        echo "✓ Ollama service is running"
    else
        echo "Starting Ollama service..."
        brew services start ollama
        sleep 2
    fi
    
    # Check for models
    echo "Available models:"
    ollama list | tail -n +2
    
    # Start the server
    echo ""
    echo "Starting local server..."
    cd server
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    # Start server in background
    npm start &
    SERVER_PID=$!
    
    echo "Server starting (PID: $SERVER_PID)..."
    sleep 3
    
    # Test the server
    echo ""
    echo "Testing server health..."
    if curl -s http://localhost:3001/health > /dev/null; then
        echo "✓ Server is healthy"
        
        # Test analysis
        echo ""
        echo "Testing tweet analysis..."
        curl -s -X POST http://localhost:3001/analyze \
          -H "Content-Type: application/json" \
          -d '{
            "text": "Just published my research on quantum computing applications in healthcare. Link to paper: example.com/paper",
            "interests": ["technology", "science"],
            "threshold": 30
          }' | python3 -m json.tool
    else
        echo "✗ Server is not responding"
    fi
    
    echo ""
    echo "Server is running on http://localhost:3001"
    echo "Press Ctrl+C to stop the server"
    
    # Wait for user to stop
    wait $SERVER_PID
    
else
    echo "✗ Ollama is not installed"
    echo "The extension will work with heuristic analysis only"
    echo "To enable AI analysis, install Ollama:"
    echo "  brew install ollama"
    echo "  brew services start ollama"
    echo "  ollama pull llama3.2:1b"
fi
