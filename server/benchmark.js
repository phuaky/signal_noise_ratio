import fetch from 'node-fetch';
import { performance } from 'perf_hooks';
import chalk from 'chalk';

const SERVER_URL = 'http://localhost:3001';

// Test tweets of varying complexity
const TEST_TWEETS = [
  // Short tweets
  {
    category: 'Short',
    tweets: [
      "Great day today!",
      "Just had coffee ☕",
      "lol",
      "ratio + L",
      "First!"
    ]
  },
  // Medium tweets
  {
    category: 'Medium',
    tweets: [
      "Just finished reading an amazing book on quantum computing. The implications for cryptography are mind-blowing!",
      "Breaking: Major tech company announces layoffs affecting 10,000 employees worldwide",
      "Thread: Here's what I learned from building my first startup 🧵",
      "WHO ELSE IS TIRED OF THIS?!?! 😤😤😤 LIKE IF YOU AGREE!!!",
      "New research paper on climate change mitigation strategies: [link]"
    ]
  },
  // Long tweets
  {
    category: 'Long',
    tweets: [
      "After spending 6 months researching distributed systems, I've compiled my findings into this comprehensive guide. It covers everything from consensus algorithms to practical implementation patterns. The key insight is that consistency and availability aren't binary choices but exist on a spectrum.",
      "🚨 BREAKING 🚨 You won't BELIEVE what just happened!!! This is INSANE!!! The mainstream media doesn't want you to know about this but I'm going to expose EVERYTHING!!! Share before they take this down!!! Wake up people!!! 😱😱😱 #Truth #WakeUp #Breaking",
      "Fascinating paper on the intersection of neuroscience and AI. The authors demonstrate how biological neural networks inspire new architectures for machine learning. Key findings: 1) Sparse connectivity improves generalization 2) Hierarchical processing mirrors cortical organization 3) Attention mechanisms have biological analogues"
    ]
  }
];

// Available models to test (user should have these installed)
const MODELS_TO_TEST = [
  'llama3.2:1b',
  'llama3.2:3b',
  'llama3.1:8b',
  'mistral:7b',
  'phi3:mini'
];

class Benchmark {
  constructor() {
    this.results = {
      models: {},
      summary: {}
    };
  }

  async checkServerHealth() {
    try {
      const response = await fetch(`${SERVER_URL}/health`);
      const data = await response.json();
      
      if (!data.ollama.connected) {
        throw new Error('Ollama is not connected');
      }
      
      return data.ollama.models;
    } catch (error) {
      console.error(chalk.red('❌ Error connecting to server:'), error.message);
      console.log(chalk.yellow('Make sure the server is running: cd server && npm start'));
      process.exit(1);
    }
  }

  async benchmarkModel(model, tweets) {
    console.log(chalk.blue(`\n📊 Benchmarking ${model}...`));
    
    const results = {
      latencies: [],
      scores: [],
      errors: 0,
      categories: {}
    };

    for (const category of tweets) {
      console.log(chalk.gray(`  Testing ${category.category} tweets...`));
      results.categories[category.category] = {
        latencies: [],
        scores: []
      };

      for (const tweet of category.tweets) {
        try {
          const start = performance.now();
          
          const response = await fetch(`${SERVER_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              text: tweet,
              model: model // Specify which model to use
            })
          });

          const latency = performance.now() - start;
          const data = await response.json();

          results.latencies.push(latency);
          results.scores.push(data.score);
          results.categories[category.category].latencies.push(latency);
          results.categories[category.category].scores.push(data.score);

        } catch (error) {
          results.errors++;
          console.error(chalk.red(`    Error: ${error.message}`));
        }
      }
    }

    return this.calculateStats(results);
  }

  calculateStats(results) {
    const stats = {
      avgLatency: this.average(results.latencies),
      minLatency: Math.min(...results.latencies),
      maxLatency: Math.max(...results.latencies),
      p95Latency: this.percentile(results.latencies, 0.95),
      avgScore: this.average(results.scores),
      errorRate: results.errors / (results.latencies.length + results.errors),
      categories: {}
    };

    // Calculate stats per category
    for (const [category, data] of Object.entries(results.categories)) {
      stats.categories[category] = {
        avgLatency: this.average(data.latencies),
        avgScore: this.average(data.scores)
      };
    }

    return stats;
  }

  average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }

  async runBenchmarks() {
    console.log(chalk.bold.green('\n🚀 Signal/Noise Ratio - Ollama Model Benchmark\n'));
    
    // Check server and get available models
    const availableModels = await this.checkServerHealth();
    console.log(chalk.green('✅ Server connected'));
    console.log(chalk.gray('Available models:', availableModels.map(m => m.name).join(', ')));

    // Filter to only test available models
    const modelsToTest = MODELS_TO_TEST.filter(model => 
      availableModels.some(m => m.name === model)
    );

    if (modelsToTest.length === 0) {
      console.log(chalk.yellow('\n⚠️  No benchmark models found. Install some models first:'));
      MODELS_TO_TEST.forEach(model => {
        console.log(chalk.gray(`  ollama pull ${model}`));
      });
      return;
    }

    console.log(chalk.blue('\nModels to benchmark:'), modelsToTest.join(', '));
    console.log(chalk.gray(`Testing with ${TEST_TWEETS.reduce((acc, cat) => acc + cat.tweets.length, 0)} tweets\n`));

    // Run benchmarks for each model
    for (const model of modelsToTest) {
      this.results.models[model] = await this.benchmarkModel(model, TEST_TWEETS);
    }

    // Print results
    this.printResults();
  }

  printResults() {
    console.log(chalk.bold.green('\n📈 Benchmark Results\n'));

    // Create comparison table
    console.log(chalk.bold('Performance Comparison:'));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(
      chalk.bold('Model'.padEnd(20)) +
      chalk.bold('Avg Latency'.padEnd(15)) +
      chalk.bold('P95 Latency'.padEnd(15)) +
      chalk.bold('Avg Score'.padEnd(12)) +
      chalk.bold('Error Rate'.padEnd(12))
    );
    console.log(chalk.gray('─'.repeat(80)));

    const models = Object.entries(this.results.models);
    models.sort((a, b) => a[1].avgLatency - b[1].avgLatency); // Sort by speed

    for (const [model, stats] of models) {
      console.log(
        model.padEnd(20) +
        chalk.cyan(`${Math.round(stats.avgLatency)}ms`.padEnd(15)) +
        chalk.yellow(`${Math.round(stats.p95Latency)}ms`.padEnd(15)) +
        chalk.green(`${stats.avgScore.toFixed(1)}`.padEnd(12)) +
        chalk.red(`${(stats.errorRate * 100).toFixed(1)}%`.padEnd(12))
      );
    }

    console.log(chalk.gray('─'.repeat(80)));

    // Category breakdown for best model
    const [bestModel] = models[0];
    console.log(chalk.bold(`\n📊 Category Breakdown (${bestModel}):`));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(
      chalk.bold('Category'.padEnd(15)) +
      chalk.bold('Avg Latency'.padEnd(15)) +
      chalk.bold('Avg Score'.padEnd(15))
    );
    console.log(chalk.gray('─'.repeat(50)));

    for (const [category, stats] of Object.entries(this.results.models[bestModel].categories)) {
      console.log(
        category.padEnd(15) +
        chalk.cyan(`${Math.round(stats.avgLatency)}ms`.padEnd(15)) +
        chalk.green(`${stats.avgScore.toFixed(1)}`.padEnd(15))
      );
    }

    // Recommendations
    console.log(chalk.bold.green('\n💡 Recommendations:\n'));
    
    const fastest = models[0][0];
    const mostAccurate = models.reduce((prev, curr) => 
      curr[1].avgScore > prev[1].avgScore ? curr : prev
    )[0];

    console.log(chalk.green(`✅ Fastest model: ${fastest}`));
    console.log(chalk.blue(`🎯 Most accurate: ${mostAccurate}`));
    
    if (fastest === 'llama3.2:1b' && stats.avgLatency < 500) {
      console.log(chalk.yellow('\n⚡ llama3.2:1b provides excellent speed for real-time analysis'));
    }
    
    if (models.length > 1) {
      const secondFastest = models[1][0];
      const speedDiff = ((models[1][1].avgLatency - models[0][1].avgLatency) / models[0][1].avgLatency * 100).toFixed(0);
      console.log(chalk.gray(`\n${secondFastest} is ${speedDiff}% slower but may provide better accuracy`));
    }
  }

  async runConcurrentTest() {
    console.log(chalk.bold.blue('\n🔥 Concurrent Request Test\n'));
    
    const concurrencyLevels = [1, 5, 10, 20];
    const testTweet = TEST_TWEETS[1].tweets[0]; // Use a medium complexity tweet
    
    for (const level of concurrencyLevels) {
      console.log(chalk.gray(`Testing ${level} concurrent requests...`));
      
      const start = performance.now();
      const promises = Array(level).fill(null).map(() => 
        fetch(`${SERVER_URL}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: testTweet })
        })
      );
      
      try {
        await Promise.all(promises);
        const duration = performance.now() - start;
        const avgPerRequest = duration / level;
        
        console.log(chalk.green(`  ✓ ${level} requests completed in ${Math.round(duration)}ms (${Math.round(avgPerRequest)}ms per request)`));
      } catch (error) {
        console.log(chalk.red(`  ✗ Failed at ${level} concurrent requests: ${error.message}`));
        break;
      }
    }
  }
}

// Run benchmarks
async function main() {
  const benchmark = new Benchmark();
  
  try {
    await benchmark.runBenchmarks();
    await benchmark.runConcurrentTest();
    
    console.log(chalk.bold.green('\n✨ Benchmark complete!\n'));
  } catch (error) {
    console.error(chalk.red('\n❌ Benchmark failed:'), error.message);
    process.exit(1);
  }
}

main();