#!/bin/bash

# Signal/Noise Ratio - AI Analysis Test Script
# This script tests the local LLM server and compares analysis methods

echo "=================================="
echo "Signal/Noise AI Analysis Tester"
echo "=================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test tweets for analysis
declare -a test_tweets=(
  "Just published my new research paper on quantum computing applications in healthcare. The results show a 40% improvement in diagnostic accuracy. Link: example.com/paper"
  "BREAKING: You WON'T BELIEVE what this celebrity just did!!! 😱😱😱 Click here to find out!!!"
  "Thread 🧵: Let me explain why the recent advances in renewable energy storage are going to fundamentally change how we think about grid infrastructure. 1/12"
  "lol 😂😂😂"
  "The new climate report from the IPCC highlights concerning trends in global temperature rise. Key findings include accelerated ice sheet melting and ecosystem disruption. Full analysis: climate.org/report"
  "anyone else tired today? 😴"
  "Excited to announce our Series B funding of $50M led by @sequoia. We're using this to expand our AI research team and accelerate product development. More details on our blog."
  "This is INSANE!!! RT if you agree!!!! 🔥🔥🔥"
)

declare -a expected_classification=(
  "SIGNAL"  # Research paper
  "NOISE"   # Clickbait
  "SIGNAL"  # Thread with substance
  "NOISE"   # Low effort
  "SIGNAL"  # Climate report
  "NOISE"   # Low effort personal
  "SIGNAL"  # Funding announcement
  "NOISE"   # Rage bait
)

# Function to test heuristic analysis
test_heuristic() {
  echo -e "${YELLOW}Testing Heuristic Analysis...${NC}"
  echo "------------------------------"
  
  for i in "${!test_tweets[@]}"; do
    tweet="${test_tweets[$i]}"
    expected="${expected_classification[$i]}"
    
    # Simple heuristic checks
    score=50
    classification="UNKNOWN"
    
    # Positive signals
    [[ "$tweet" =~ https?:// ]] && ((score+=20))
    [[ "$tweet" =~ [Tt]hread ]] && ((score+=15))
    [[ "$tweet" =~ [Rr]esearch|[Pp]aper|[Rr]eport|[Aa]nalysis ]] && ((score+=15))
    [[ ${#tweet} -gt 150 ]] && ((score+=10))
    
    # Negative signals
    [[ "$tweet" =~ BREAKING|WON\'T\ BELIEVE|INSANE ]] && ((score-=30))
    [[ "$tweet" =~ 😱{2,}|😂{2,}|🔥{2,} ]] && ((score-=20))
    [[ "$tweet" =~ !!!|RT\ if ]] && ((score-=20))
    [[ ${#tweet} -lt 50 ]] && ((score-=15))
    
    # Classify
    if [ $score -ge 60 ]; then
      classification="SIGNAL"
    else
      classification="NOISE"
    fi
    
    # Compare with expected
    if [ "$classification" == "$expected" ]; then
      echo -e "${GREEN}✓${NC} Tweet $((i+1)): $classification (Score: $score) - CORRECT"
    else
      echo -e "${RED}✗${NC} Tweet $((i+1)): $classification (Score: $score) - Expected: $expected"
    fi
    
    echo "  \"${tweet:0:60}...\""
    echo ""
  done
}

# Function to test local LLM
test_local_llm() {
  echo -e "${YELLOW}Testing Local LLM Analysis...${NC}"
  echo "------------------------------"
  
  # Check if server is running
  if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${RED}✗ Local LLM server is not running${NC}"
    echo "  Start it with: cd /Users/pky/Code/signal_noise_ratio && ./start-server.sh"
    return 1
  fi
  
  echo -e "${GREEN}✓ Local LLM server is running${NC}"
  echo ""
  
  for i in "${!test_tweets[@]}"; do
    tweet="${test_tweets[$i]}"
    expected="${expected_classification[$i]}"
    
    # Send to local LLM
    response=$(curl -s -X POST http://localhost:3001/analyze \
      -H "Content-Type: application/json" \
      -d "{
        \"text\": \"$tweet\",
        \"interests\": [\"technology\", \"science\", \"climate\", \"AI\"],
        \"threshold\": 30
      }" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$response" ]; then
      # Parse response (assuming JSON with isSignal field)
      isSignal=$(echo "$response" | grep -o '"isSignal":[^,}]*' | cut -d':' -f2 | tr -d ' ')
      score=$(echo "$response" | grep -o '"score":[^,}]*' | cut -d':' -f2 | tr -d ' ')
      reason=$(echo "$response" | grep -o '"reason":"[^"]*"' | cut -d'"' -f4)
      
      if [ "$isSignal" == "true" ]; then
        classification="SIGNAL"
      else
        classification="NOISE"
      fi
      
      # Compare with expected
      if [ "$classification" == "$expected" ]; then
        echo -e "${GREEN}✓${NC} Tweet $((i+1)): $classification (Score: $score) - CORRECT"
      else
        echo -e "${RED}✗${NC} Tweet $((i+1)): $classification (Score: $score) - Expected: $expected"
      fi
      
      echo "  \"${tweet:0:60}...\""
      [ -n "$reason" ] && echo "  AI Reasoning: $reason"
      echo ""
    else
      echo -e "${RED}✗${NC} Tweet $((i+1)): Failed to analyze"
      echo ""
    fi
  done
}

# Function to compare methods
compare_methods() {
  echo -e "${YELLOW}Comparison Summary${NC}"
  echo "=================="
  echo ""
  
  echo "Heuristic Analysis:"
  echo "  - Speed: ~1ms per tweet"
  echo "  - Accuracy: Basic pattern matching"
  echo "  - Privacy: 100% local"
  echo "  - Cost: Free"
  echo ""
  
  echo "Local LLM (Ollama):"
  echo "  - Speed: ~500ms per tweet"
  echo "  - Accuracy: Context-aware AI analysis"
  echo "  - Privacy: 100% local"
  echo "  - Cost: Free (uses your CPU/GPU)"
  echo ""
  
  echo "Cloud AI (Claude/GPT):"
  echo "  - Speed: ~1000ms per tweet"
  echo "  - Accuracy: Best available"
  echo "  - Privacy: Data sent to cloud"
  echo "  - Cost: ~$0.01 per 1000 tweets"
}

# Main execution
echo "Starting analysis tests..."
echo ""

# Test heuristic
test_heuristic

echo ""
echo "=================================="
echo ""

# Test local LLM
test_local_llm

echo ""
echo "=================================="
echo ""

# Show comparison
compare_methods

echo ""
echo "=================================="
echo -e "${GREEN}Testing Complete!${NC}"
echo ""
echo "Next Steps:"
echo "1. If local LLM failed, start the server:"
echo "   cd /Users/pky/Code/signal_noise_ratio && ./start-server.sh"
echo ""
echo "2. Load extension in Chrome and test on real tweets:"
echo "   - Go to chrome://extensions/"
echo "   - Load unpacked: /Users/pky/Code/signal_noise_ratio"
echo "   - Navigate to x.com"
echo ""
echo "3. Run the diagnostic script in Chrome Console:"
echo "   Open DevTools and paste: /Users/pky/Code/signal_noise_ratio/diagnostic.js"
