import fetch from 'node-fetch';

async function testLogging() {
  console.log('Testing new logging format...\n');

  const testTweets = [
    {
      text: "Just published our research on quantum computing applications in drug discovery. Link to paper: arxiv.org/1234",
      expectedScore: 90
    },
    {
      text: "BREAKING: You won't BELIEVE what just happened!!!",
      expectedScore: 15
    },
    {
      text: "Thread: Here's what I learned building a distributed system from scratch 🧵",
      expectedScore: 85
    }
  ];

  for (const tweet of testTweets) {
    try {
      const response = await fetch('http://localhost:3001/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: tweet.text,
          interests: [],
          signalPatterns: [],
          noisePatterns: [],
          threshold: 30
        }),
      });

      const result = await response.json();
      console.log(`\nExpected score ~${tweet.expectedScore}, got ${result.score}`);
      console.log('---');
    } catch (error) {
      console.error('Error testing tweet:', error.message);
    }

    // Wait a bit between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Wait for server to start
setTimeout(testLogging, 2000);
console.log('Waiting for server to start...');