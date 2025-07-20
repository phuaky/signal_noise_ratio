import OllamaClient from './ollama-client.js';

console.log('Testing Ollama connection...\n');

const client = new OllamaClient();

// Test 1: Check health
const isHealthy = await client.checkHealth();
console.log('✓ Ollama health check:', isHealthy ? 'Connected' : 'Not connected');

if (!isHealthy) {
  console.error('\n❌ Ollama is not running. Please start it with: brew services start ollama');
  process.exit(1);
}

// Test 2: List models
const models = await client.listModels();
console.log('\n✓ Available models:');
if (models.length === 0) {
  console.log('  No models installed yet');
} else {
  models.forEach(model => {
    console.log(`  - ${model.name} (${(model.size / 1e9).toFixed(1)}GB)`);
  });
}

// Test 3: Analyze sample tweets
if (models.length > 0) {
  console.log('\n✓ Testing tweet analysis...\n');
  
  const testTweets = [
    "Just published my analysis on how quantum computing will revolutionize drug discovery in the next decade. Full paper: [link]",
    "BREAKING: You won't BELIEVE what this celebrity just did!!!",
    "Thread: Here's what I learned spending 6 months building a distributed system from scratch 🧵",
    "ratio + L + didn't ask + cope harder",
    "New blog post: A deep dive into WebAssembly performance optimizations with real benchmarks"
  ];

  for (const tweet of testTweets) {
    const startTime = Date.now();
    const result = await client.analyzeTweet(tweet);
    const latency = Date.now() - startTime;
    
    console.log(`Tweet: "${tweet.substring(0, 60)}..."`);
    console.log(`Score: ${result.score}/100 (${result.isSignal ? 'SIGNAL' : 'NOISE'})`);
    console.log(`Reason: ${result.reason}`);
    console.log(`Latency: ${latency}ms\n`);
  }
}

console.log('✓ All tests completed!');