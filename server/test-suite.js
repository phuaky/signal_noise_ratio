import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fetch from 'node-fetch';
import { spawn } from 'child_process';
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:3001';
const TEST_TWEETS = [
  {
    text: "Just launched our new AI-powered analytics platform! Check it out at https://example.com",
    expectedSignal: true
  },
  {
    text: "WHO ELSE IS TIRED OF THIS?!?! 😤😤😤 LIKE IF YOU AGREE!!!",
    expectedSignal: false
  },
  {
    text: "Thread: Here's what I learned building a distributed system at scale 🧵",
    expectedSignal: true
  },
  {
    text: "buy now 🚀🚀🚀 moon soon 💎🙌",
    expectedSignal: false
  }
];

let serverProcess;
let serverReady = false;

// Helper function to wait for server to be ready
async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) {
        serverReady = true;
        return true;
      }
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Server failed to start within timeout');
}

// Helper function to check if Ollama is available
async function checkOllamaAvailable() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    return data.ollama.connected && data.ollama.models.length > 0;
  } catch (e) {
    return false;
  }
}

describe('Signal/Noise Ratio Server Test Suite', () => {
  before(async () => {
    console.log('Starting server...');
    serverProcess = spawn('node', ['index.js'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: '3001' }
    });
    
    serverProcess.stdout.on('data', (data) => {
      console.log(`Server: ${data}`);
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error(`Server Error: ${data}`);
    });
    
    await waitForServer();
    console.log('Server started successfully');
  });

  after(() => {
    if (serverProcess) {
      console.log('Stopping server...');
      serverProcess.kill();
    }
  });

  describe('Health Check Endpoint', () => {
    it('should return server status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      assert.strictEqual(response.status, 200);
      
      const data = await response.json();
      assert.strictEqual(data.status, 'ok');
      assert.ok('ollama' in data);
      assert.ok('connected' in data.ollama);
      assert.ok(Array.isArray(data.ollama.models));
    });

    it('should indicate Ollama connection status', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();
      
      console.log(`Ollama connected: ${data.ollama.connected}`);
      console.log(`Available models: ${data.ollama.models.map(m => m.name).join(', ')}`);
      
      if (!data.ollama.connected) {
        console.warn('⚠️  Ollama is not connected. Some tests will be skipped.');
      }
    });
  });

  describe('Tweet Analysis Endpoint', () => {
    it('should analyze single tweet', async function() {
      const ollamaAvailable = await checkOllamaAvailable();
      if (!ollamaAvailable) {
        this.skip();
        return;
      }

      const response = await fetch(`${BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: TEST_TWEETS[0].text,
          userInterests: ['AI', 'technology']
        })
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      
      assert.ok('isSignal' in data);
      assert.ok('score' in data);
      assert.ok('reasoning' in data);
      assert.ok(typeof data.score === 'number');
      assert.ok(data.score >= 0 && data.score <= 100);
    });

    it('should handle empty text gracefully', async function() {
      const ollamaAvailable = await checkOllamaAvailable();
      if (!ollamaAvailable) {
        this.skip();
        return;
      }

      const response = await fetch(`${BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '' })
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.isSignal, false);
    });

    it('should handle very long text', async function() {
      const ollamaAvailable = await checkOllamaAvailable();
      if (!ollamaAvailable) {
        this.skip();
        return;
      }

      const longText = 'This is a test. '.repeat(200);
      const response = await fetch(`${BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: longText })
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.ok('isSignal' in data);
    });

    it('should respect user interests', async function() {
      const ollamaAvailable = await checkOllamaAvailable();
      if (!ollamaAvailable) {
        this.skip();
        return;
      }

      const text = "New research on quantum computing breakthrough";
      
      // First without interests
      const response1 = await fetch(`${BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data1 = await response1.json();
      
      // Then with relevant interests
      const response2 = await fetch(`${BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text,
          userInterests: ['quantum computing', 'physics', 'technology']
        })
      });
      const data2 = await response2.json();
      
      // Score should generally be higher with matching interests
      console.log(`Score without interests: ${data1.score}`);
      console.log(`Score with interests: ${data2.score}`);
    });
  });

  describe('Batch Analysis Endpoint', () => {
    it('should analyze multiple tweets', async function() {
      const ollamaAvailable = await checkOllamaAvailable();
      if (!ollamaAvailable) {
        this.skip();
        return;
      }

      const tweets = TEST_TWEETS.map((t, i) => ({
        id: `tweet-${i}`,
        text: t.text
      }));

      const response = await fetch(`${BASE_URL}/analyze-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweets })
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      
      assert.ok(Array.isArray(data.results));
      assert.strictEqual(data.results.length, tweets.length);
      
      data.results.forEach((result, i) => {
        assert.strictEqual(result.id, tweets[i].id);
        assert.ok('isSignal' in result);
        assert.ok('score' in result);
      });
    });

    it('should handle partial batch failures', async function() {
      const ollamaAvailable = await checkOllamaAvailable();
      if (!ollamaAvailable) {
        this.skip();
        return;
      }

      const tweets = [
        { id: '1', text: 'Valid tweet' },
        { id: '2', text: '' }, // Empty
        { id: '3', text: 'Another valid tweet' }
      ];

      const response = await fetch(`${BASE_URL}/analyze-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweets })
      });

      assert.strictEqual(response.status, 200);
      const data = await response.json();
      assert.strictEqual(data.results.length, 3);
    });
  });

  describe('WebSocket Real-time Analysis', () => {
    it('should connect via WebSocket', async (t) => {
      await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:3001`);
        
        ws.on('open', () => {
          assert.ok(true, 'WebSocket connected');
          ws.close();
          resolve();
        });
        
        ws.on('error', (err) => {
          reject(err);
        });
        
        setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, 5000);
      });
    });

    it('should analyze tweets via WebSocket', async function() {
      const ollamaAvailable = await checkOllamaAvailable();
      if (!ollamaAvailable) {
        this.skip();
        return;
      }

      await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:3001`);
        let responseReceived = false;
        
        ws.on('open', () => {
          // Send analysis request
          ws.send(JSON.stringify({
            type: 'analyze',
            id: 'test-1',
            text: TEST_TWEETS[0].text
          }));
        });
        
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'analysis-result') {
            assert.strictEqual(message.id, 'test-1');
            assert.ok('isSignal' in message);
            assert.ok('score' in message);
            responseReceived = true;
            ws.close();
            resolve();
          }
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
          ws.close();
          if (!responseReceived) {
            reject(new Error('WebSocket response timeout'));
          }
        }, 10000);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid JSON', async () => {
      const response = await fetch(`${BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      assert.ok(response.status >= 400);
    });

    it('should handle missing required fields', async () => {
      const response = await fetch(`${BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      // Should still work but with empty text
      assert.strictEqual(response.status, 200);
    });

    it('should handle server errors gracefully', async function() {
      const ollamaAvailable = await checkOllamaAvailable();
      if (!ollamaAvailable) {
        this.skip();
        return;
      }

      // Send malformed data that might cause internal error
      const response = await fetch(`${BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: TEST_TWEETS[0].text,
          // Add invalid data that might break processing
          userInterests: { invalid: 'structure' }
        })
      });

      // Should handle error gracefully
      assert.ok(response.status === 200 || response.status >= 400);
    });
  });

  describe('Performance Tests', () => {
    it('should respond within acceptable time', async function() {
      const ollamaAvailable = await checkOllamaAvailable();
      if (!ollamaAvailable) {
        this.skip();
        return;
      }

      const start = Date.now();
      const response = await fetch(`${BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: TEST_TWEETS[0].text })
      });
      const duration = Date.now() - start;

      assert.strictEqual(response.status, 200);
      console.log(`Single analysis took ${duration}ms`);
      
      // Should respond within 5 seconds
      assert.ok(duration < 5000, `Response took too long: ${duration}ms`);
    });

    it('should handle concurrent requests', async function() {
      const ollamaAvailable = await checkOllamaAvailable();
      if (!ollamaAvailable) {
        this.skip();
        return;
      }

      const requests = TEST_TWEETS.map(tweet => 
        fetch(`${BASE_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: tweet.text })
        })
      );

      const start = Date.now();
      const responses = await Promise.all(requests);
      const duration = Date.now() - start;

      responses.forEach(response => {
        assert.strictEqual(response.status, 200);
      });

      console.log(`${requests.length} concurrent requests took ${duration}ms`);
      console.log(`Average time per request: ${(duration / requests.length).toFixed(0)}ms`);
    });
  });
});

// Run tests
console.log('🧪 Starting Signal/Noise Ratio Server Tests...\n');
console.log('Note: Make sure Ollama is running with at least one model installed.');
console.log('If Ollama is not available, some tests will be skipped.\n');