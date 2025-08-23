import fetch from 'node-fetch';

const serverUrl = 'http://localhost:3001';

const testCases = [
  {
    name: 'YC Startup (HIGH SIGNAL)',
    tweetData: {
      text: 'Just got accepted into YC W24! Building AI-powered developer tools that help teams ship 10x faster',
      author: {
        handle: '@alice_founder',
        displayName: 'Alice Chen - Building AI',
        isVerified: false,
        isBlueVerified: true
      },
      hasMedia: false,
      mediaTypes: [],
      links: [{domain: 'github.com', url: 'https://github.com/example'}],
      hashtags: ['#YCombinator', '#AI']
    }
  },
  {
    name: 'Celebrity Gossip (NOISE)',
    tweetData: {
      text: 'OMG the drama at the Oscars last night! Can you believe what she wore to the red carpet?',
      author: {
        handle: '@EntertainmentDaily',
        displayName: 'Entertainment News',
        isVerified: false,
        isBlueVerified: false
      },
      hasMedia: true,
      mediaTypes: ['photo'],
      links: [],
      hashtags: ['#Oscars', '#RedCarpet']
    }
  },
  {
    name: 'Technical Tutorial (HIGH SIGNAL)',
    tweetData: {
      text: 'Thread on optimizing React performance: 1/ Use React.memo 2/ Implement virtual scrolling 3/ Code splitting',
      author: {
        handle: '@dev_tips',
        displayName: 'Dev Tips Daily',
        isVerified: false,
        isBlueVerified: false
      },
      hasMedia: false,
      mediaTypes: [],
      links: [],
      hashtags: ['#React', '#WebDev']
    }
  },
  {
    name: 'Food Content (NOISE)',
    tweetData: {
      text: 'My secret recipe for the perfect chocolate cake! Swipe for ingredients',
      author: {
        handle: '@FoodieBlogger',
        displayName: 'Food & Recipes',
        isVerified: false,
        isBlueVerified: true
      },
      hasMedia: true,
      mediaTypes: ['photo'],
      links: [{domain: 'instagram.com', url: 'https://instagram.com/recipe'}],
      hashtags: ['#Recipe', '#Baking']
    }
  }
];

async function runTests() {
  console.log('Testing new prompts with sample tweets...\n');
  console.log('Expected: YC/Tech content = HIGH SIGNAL (score 80+)');
  console.log('Expected: Entertainment/Food = NOISE (score <30)\n');
  
  for (const test of testCases) {
    console.log('='.repeat(70));
    console.log(`TEST: ${test.name}`);
    console.log(`Tweet: "${test.tweetData.text.substring(0, 60)}..."`);
    console.log(`Author: ${test.tweetData.author.handle}`);
    
    try {
      const response = await fetch(`${serverUrl}/analyze-multi-agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweetData: test.tweetData })
      });
      
      const result = await response.json();
      
      console.log('\nRESULT:');
      console.log(`  Final Score: ${result.score}/100`);
      console.log(`  Is Signal: ${result.isSignal ? '✅ YES' : '❌ NO'}`);
      console.log(`  Reason: ${result.reason}`);
      
      if (result.agentScores) {
        console.log('\nAgent Breakdown:');
        if (result.agentScores.content) {
          console.log(`  Content: ${result.agentScores.content.score} - ${result.agentScores.content.reason}`);
        }
        if (result.agentScores.account) {
          console.log(`  Account: ${result.agentScores.account.score} - ${result.agentScores.account.reason}`);
        }
        if (result.agentScores.media) {
          console.log(`  Media: ${result.agentScores.media.score} - ${result.agentScores.media.reason}`);
        }
      }
      
      console.log();
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

// Wait for server to be ready
setTimeout(runTests, 1000);