#!/bin/bash

# Start the server with prompt logging enabled
echo "Starting server with new logging..."
SHOW_PROMPTS=1 npm start &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Run the test
echo -e "\n\nRunning test requests..."
node test-logging.js

# Kill the server after tests
sleep 5
kill $SERVER_PID

echo -e "\n\nTest complete!"