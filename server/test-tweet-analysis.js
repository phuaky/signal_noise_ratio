#!/usr/bin/env node

// Test tweet analysis with both heuristic and AI modes
import fetch from 'node-fetch';
import WebSocket from 'ws';

const SERVER_URL = 'http://localhost:3001';

// Sample tweets for testing
const testTweets = [
  // High-quality signal tweets
  {
    id: 'signal-1',
    text: 'New research paper: "Neural Networks in Climate Modeling" shows 40% improvement in precipitation forecasting accuracy. Full paper: https://arxiv.org/papers/climate-nn-2024',
    author: 'Dr. Jane Smith',
    verified: true,
    metrics: { likes: 1250, retweets: 450, replies: 89 },
    expectedClass: 'signal',
    description: 'Academic research with link'
  },
  {
    id: 'signal-2',
    text: 'Thread 1/8: Breaking down the Federal Reserve\'s latest interest rate decision and what it means for mortgage rates, savings accounts, and the broader economy. Let me explain the key points...',
    author: 'Finance Expert',
    verified: true,
    metrics: { likes: 3400, retweets: 890, replies: 234 },
    expectedClass: 'signal',
    description: 'Educational thread'
  },
  
  // Low-quality noise tweets
  {
    id: 'noise-1',
    text: 'OMG YOU WON\'T BELIEVE WHAT JUST HAPPENED!!! 😱😱😱 CLICK HERE NOW!!! 🔥🔥🔥',
    author: 'ClickbaitAccount',
    verified: false,
    metrics: { likes: 12, retweets: 3, replies: 145 },
    expectedClass: 'noise',
    description: 'Clickbait with excessive emojis'
  },
  {
    id: 'noise-2',
    text: 'EVERYONE WHO LIKES THIS TWEET WILL BECOME RICH!!! I\'M NOT JOKING!!! 💰💰💰',
    author: 'SpamBot2024',
    verified: false,
    metrics: { likes: 5, retweets: 1, replies: 0 },
    expectedClass: 'noise',
    description: 'Engagement farming spam'
  },
  
  // Borderline tweets
  {
    id: 'borderline-1',
    text: 'Just had the best coffee ever at this new place downtown! Highly recommend if you\'re in the area ☕',
    author: 'LocalReviewer',
    verified: false,
    metrics: { likes: 45, retweets: 5, replies: 12 },
    expectedClass: 'borderline',
    description: 'Personal opinion/recommendation'
  },
  {
    id: 'borderline-2',
    text: 'Markets closed mixed today. S&P500 +0.2%, NASDAQ -0.1%. Tech stocks showing weakness.',
    author: 'MarketWatch',
    verified: true,
    metrics: { likes: 230, retweets: 78, replies: 34 },
    expectedClass: 'signal',
    description: 'Brief market update'
  }
];

// Test heuristic analysis
async function testHeuristicAnalysis() {
  console.log('\n📊 Testing Heuristic Analysis\n');
  console.log('=' .repeat(50));
  
  for (const tweet of testTweets) {
    try {
      const response = await fetch(`${SERVER_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: tweet.text,
          author: tweet.author,
          verified: tweet.verified,
          metrics: tweet.metrics,
          mode: 'heuristic'
        })
      });
      const data = await response.json();
      
      const { score, classification, signals } = data;
      const icon = classification === 'signal' ? '🟢' : classification === 'noise' ? '🔴' : '🟡';
      const match = classification === tweet.expectedClass ? '✅' : '⚠️';
      
      console.log(`\n${icon} ${tweet.description}`);
      console.log(`  Expected: ${tweet.expectedClass}, Got: ${classification} ${match}`);
      console.log(`  Score: ${score}%`);
      console.log(`  Text: "${tweet.text.substring(0, 60)}..."`);
      console.log(`  Signals:`, signals);
    } catch (error) {
      console.error(`❌ Error analyzing tweet ${tweet.id}:`, error.message);
    }
  }
}

// Test AI analysis with local LLM
async function testAIAnalysis() {
  console.log('\n\n🤖 Testing AI Analysis (Local LLM)\n');
  console.log('=' .repeat(50));
  
  // Check if Ollama is available
  try {
    const healthResponse = await fetch(`${SERVER_URL}/health`);
    const health = await healthResponse.json();
    if (!health.ollama.connected) {
      console.log('⚠️ Ollama not connected. Skipping AI tests.');
      return;
    }
    console.log(`✅ Using model: ${health.ollama.models[0].name}\n`);
  } catch (error) {
    console.log('❌ Server not available:', error.message);
    return;
  }
  
  for (const tweet of testTweets.slice(0, 3)) { // Test first 3 tweets to save time
    try {
      console.log(`\nAnalyzing: "${tweet.text.substring(0, 60)}..."`);
      console.log('  Sending to AI...');
      
      const startTime = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(`${SERVER_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: tweet.text,
          author: tweet.author,
          verified: tweet.verified,
          metrics: tweet.metrics,
          mode: 'ai'
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const data = await response.json();
      
      const elapsed = Date.now() - startTime;
      const { score, classification, reasoning } = data;
      const icon = classification === 'signal' ? '🟢' : classification === 'noise' ? '🔴' : '🟡';
      
      console.log(`  ${icon} Result: ${classification} (${score}%)  [${elapsed}ms]`);
      console.log(`  AI Reasoning: ${reasoning}`);
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
    }
  }
}

// Test WebSocket real-time updates
async function testWebSocket() {
  console.log('\n\n🔌 Testing WebSocket Connection\n');
  console.log('=' .repeat(50));
  
  const ws = new WebSocket(`ws://localhost:3001`);
  
  return new Promise((resolve) => {
    ws.on('open', () => {
      console.log('✅ WebSocket connected');
      
      // Send a test message
      ws.send(JSON.stringify({
        type: 'analyze',
        data: {
          text: 'Test tweet for WebSocket analysis',
          mode: 'heuristic'
        }
      }));
      
      console.log('📤 Sent test message');
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      console.log('📥 Received:', message);
      ws.close();
      resolve();
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      resolve();
    });
    
    setTimeout(() => {
      ws.close();
      resolve();
    }, 5000);
  });
}

// Performance test
async function testPerformance() {
  console.log('\n\n⚡ Performance Test\n');
  console.log('=' .repeat(50));
  
  const iterations = 20;
  const times = [];
  
  console.log(`Running ${iterations} heuristic analyses...`);
  
  for (let i = 0; i < iterations; i++) {
    const tweet = testTweets[i % testTweets.length];
    const startTime = Date.now();
    
    try {
      await fetch(`${SERVER_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: tweet.text,
          author: tweet.author,
          mode: 'heuristic'
        })
      });
      
      const elapsed = Date.now() - startTime;
      times.push(elapsed);
      process.stdout.write('.');
    } catch (error) {
      process.stdout.write('x');
    }
  }
  
  console.log('\n');
  
  if (times.length > 0) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    
    console.log(`  Average: ${avg.toFixed(1)}ms`);
    console.log(`  Min: ${min}ms`);
    console.log(`  Max: ${max}ms`);
    console.log(`  Success rate: ${(times.length / iterations * 100).toFixed(0)}%`);
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Signal/Noise Ratio - Tweet Analysis Test Suite');
  console.log('=' .repeat(50));
  
  try {
    // Check server health first
    const healthResponse = await fetch(`${SERVER_URL}/health`);
    const health = await healthResponse.json();
    console.log('\n✅ Server is running');
    console.log(`  Ollama: ${health.ollama.connected ? 'Connected' : 'Disconnected'}`);
    if (health.ollama.connected) {
      console.log(`  Models: ${health.ollama.models.map(m => m.name).join(', ')}`);
    }
  } catch (error) {
    console.error('❌ Server not running. Start it with: npm start');
    process.exit(1);
  }
  
  // Run test suites
  await testHeuristicAnalysis();
  await testAIAnalysis();
  await testWebSocket();
  await testPerformance();
  
  console.log('\n\n✅ All tests completed!');
  console.log('=' .repeat(50));
  process.exit(0);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});