import fetch from 'node-fetch';
import logger from './logger.js';

class OllamaClient {
  constructor(host = 'http://localhost:11434') {
    this.host = host;
    this.defaultModel = 'llama3.2:3b'; // Using 3B model for better quality
    this.accountCache = new Map(); // Cache for account scores
    this.cacheTimeout = 3600000; // 1 hour cache
  }

  async checkHealth() {
    try {
      const response = await fetch(`${this.host}/api/tags`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async listModels() {
    try {
      const response = await fetch(`${this.host}/api/tags`);
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      logger.logError('Listing models', error);
      return [];
    }
  }

  async generateCompletion(prompt, options = {}) {
    const body = {
      model: options.model || this.defaultModel,
      prompt: prompt,
      stream: false,
      options: {
        temperature: options.temperature || 0.3,
        top_p: options.top_p || 0.9,
        num_predict: options.max_tokens || 150,
      }
    };

    try {
      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      logger.logError('Generating completion', error);
      throw error;
    }
  }

  async analyzeTweet(tweetText, userPreferences = {}) {
    // Single agent analysis (for backward compatibility)
    return this.analyzeContent(tweetText, userPreferences);
  }
  
  async analyzeWithMultipleAgents(tweetData, userPreferences = {}) {
    const analysisId = `multi_${Date.now().toString(36)}`;
    
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║               MULTI-AGENT ANALYSIS STARTING                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`Analysis ID: ${analysisId}`);
    console.log(`Tweet preview: "${tweetData.text.substring(0, 80)}..."`);
    console.log(`Author: ${tweetData.author?.handle || 'unknown'}`);
    console.log(`Has media: ${tweetData.hasMedia ? 'Yes' : 'No'}`);
    console.log(`External links: ${tweetData.links?.length || 0}`);
    console.log(`\nRunning 3 agents in parallel...\n`);
    
    const startTime = Date.now();
    
    // Run all agents in parallel
    const [accountResult, contentResult, mediaResult] = await Promise.allSettled([
      this.analyzeAccount(tweetData.author, userPreferences),
      this.analyzeContent(tweetData.text, userPreferences),
      this.analyzeMedia(tweetData, userPreferences)
    ]);
    
    const parallelTime = Date.now() - startTime;
    
    // Collect successful results
    const results = {
      account: accountResult.status === 'fulfilled' ? accountResult.value : null,
      content: contentResult.status === 'fulfilled' ? contentResult.value : null,
      media: mediaResult.status === 'fulfilled' ? mediaResult.value : null
    };
    
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    AGENT RESULTS SUMMARY                     ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    
    // Account Agent Summary
    console.log('\n📱 ACCOUNT AGENT:');
    if (results.account) {
      console.log(`   Score: ${results.account.score}/100 ${results.account.fromCache ? '(cached)' : ''}`);
      console.log(`   Signal: ${results.account.isSignal ? '✓ YES' : '✗ NO'}`);
      console.log(`   Reason: ${results.account.reason}`);
      console.log(`   Confidence: ${(results.account.confidence * 100).toFixed(0)}%`);
    } else {
      console.log('   ❌ Failed to analyze');
    }
    
    // Content Agent Summary
    console.log('\n📝 CONTENT AGENT:');
    if (results.content) {
      console.log(`   Score: ${results.content.score}/100`);
      console.log(`   Signal: ${results.content.isSignal ? '✓ YES' : '✗ NO'}`);
      console.log(`   Reason: ${results.content.reason}`);
      console.log(`   Confidence: ${(results.content.confidence * 100).toFixed(0)}%`);
    } else {
      console.log('   ❌ Failed to analyze');
    }
    
    // Media Agent Summary
    console.log('\n🖼️  MEDIA AGENT:');
    if (results.media) {
      console.log(`   Score: ${results.media.score}/100`);
      console.log(`   Signal: ${results.media.isSignal ? '✓ YES' : '✗ NO'}`);
      console.log(`   Reason: ${results.media.reason}`);
      console.log(`   Confidence: ${(results.media.confidence * 100).toFixed(0)}%`);
    } else {
      console.log('   ❌ Failed to analyze');
    }
    
    // Aggregate results
    const aggregated = await this.aggregateResults(results, userPreferences);
    
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                      FINAL AGGREGATED RESULT                 ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log(`🎯 FINAL SCORE: ${aggregated.score}/100`);
    console.log(`📊 SIGNAL STATUS: ${aggregated.isSignal ? '✅ HIGH SIGNAL' : '❌ NOISE'}`);
    console.log(`🤖 AGENTS USED: ${aggregated.agentCount}`);
    console.log(`⏱️  TOTAL TIME: ${parallelTime}ms`);
    console.log(`\n💭 COMBINED REASONING:`);
    console.log(`   ${aggregated.reason}`);
    console.log('\n════════════════════════════════════════════════════════════════\n');
    
    return aggregated;
  }
  
  async analyzeContent(tweetText, userPreferences = {}) {
    const prompt = this.buildAnalysisPrompt(tweetText, userPreferences);
    const requestId = `content_${Date.now().toString(36)}`;
    
    console.log('\n=== CONTENT AGENT ANALYSIS ===');
    console.log(`Request ID: ${requestId}`);
    console.log(`Tweet text: "${tweetText.substring(0, 100)}${tweetText.length > 100 ? '...' : ''}"`);
    console.log(`User preferences:`);
    console.log(`  Interests: ${userPreferences.interests?.join(', ') || 'none'}`);
    console.log(`  Signal patterns: ${userPreferences.signalPatterns?.join(', ') || 'none'}`);
    console.log(`  Noise patterns: ${userPreferences.noisePatterns?.join(', ') || 'none'}`);
    console.log(`  Threshold: ${userPreferences.threshold || 30}`);
    
    try {
      const startTime = Date.now();
      
      console.log('\n--- CONTENT AGENT PROMPT ---');
      console.log(prompt);
      console.log('--- END PROMPT ---\n');
      
      const response = await this.generateCompletion(prompt, {
        temperature: 0.1,
        max_tokens: 100
      });
      
      const latency = Date.now() - startTime;
      
      console.log('--- CONTENT AGENT RAW RESPONSE ---');
      console.log(response);
      console.log('--- END RESPONSE ---\n');

      const threshold = userPreferences.threshold || 70;
      const parsed = this.parseAnalysisResponse(response, threshold);
      parsed.agentType = 'content';
      
      console.log('--- CONTENT AGENT RESULT ---');
      console.log(`Score: ${parsed.score}`);
      console.log(`Is Signal: ${parsed.isSignal}`);
      console.log(`Reason: ${parsed.reason}`);
      console.log(`Confidence: ${parsed.confidence}`);
      console.log(`Latency: ${latency}ms`);
      console.log('=== END CONTENT AGENT ===\n');
      
      return parsed;
    } catch (error) {
      console.error(`Content agent error (${requestId}):`, error.message);
      return {
        score: 50,
        isSignal: false,
        reason: 'Content analysis failed',
        confidence: 0,
        agentType: 'content'
      };
    }
  }

  buildAnalysisPrompt(tweetText, userPreferences = {}) {
    // This is now the content-focused prompt
    const { interests = [], signalPatterns = [], noisePatterns = [] } = userPreferences;
    
    let contextParts = [];
    
    if (interests.length > 0) {
      contextParts.push(`User interests: ${interests.join(', ')}`);
    }
    
    if (signalPatterns.length > 0) {
      contextParts.push(`Signal indicators (rate higher): ${signalPatterns.join(', ')}`);
    }
    
    if (noisePatterns.length > 0) {
      contextParts.push(`Noise indicators (rate lower): ${noisePatterns.join(', ')}`);
    }
    
    const contextSection = contextParts.length > 0 
      ? contextParts.join('\n') + '\n\n' 
      : '';

    return `You are a tweet content analyzer. Focus ONLY on the text content quality, ignoring who posted it.

${contextSection}Analyze this tweet and respond with ONLY a JSON object:

Tweet: "${tweetText}"

Response format:
{
  "score": <0-100 where 100 is highest signal>,
  "reason": "<one sentence explanation>",
  "confidence": <0.0-1.0>
}

Examples:
Tweet: "Just published our research on quantum computing applications in drug discovery. We found that quantum algorithms can reduce computation time by 40% for molecular simulations. Link to paper: [...]"
{"score": 95, "reason": "Original research with specific findings and data", "confidence": 0.95}

Tweet: "BREAKING: You won't BELIEVE what just happened!!! This changes EVERYTHING!!! 🤯🤯🤯"
{"score": 10, "reason": "Pure clickbait with no informational content", "confidence": 0.9}

Tweet: "Thread on building scalable systems: 1/ Start with a monolith 2/ Profile before optimizing 3/ Cache aggressively but invalidate wisely 4/ Database indexes are your friend 5/ Monitor everything"
{"score": 85, "reason": "Practical technical advice with actionable insights", "confidence": 0.85}

Tweet: "Hot take: Python > JavaScript for backend development. Better ecosystem, cleaner syntax, more mature tooling. Fight me."
{"score": 45, "reason": "Opinion without supporting evidence or depth", "confidence": 0.7}

Tweet: "Anyone else tired of all the drama? Just vibing today fr fr no cap"
{"score": 15, "reason": "No informational value, just mood posting", "confidence": 0.8}

Now analyze the given tweet:`;
  }

  parseAnalysisResponse(response, threshold = 70) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const score = Math.max(0, Math.min(100, parsed.score || 50));
        return {
          score,
          isSignal: score >= (100 - threshold), // Convert threshold to signal cutoff
          reason: parsed.reason || 'No reason provided',
          confidence: parsed.confidence || 0.5
        };
      }
    } catch (error) {
      logger.logError('Parsing LLM response', error);
    }

    // Fallback parsing
    return {
      score: 50,
      isSignal: false,
      reason: 'Could not parse response',
      confidence: 0
    };
  }

  async analyzeTweetBatch(tweets, userInterests = []) {
    // Batch analysis for efficiency
    const batchPrompt = this.buildBatchPrompt(tweets, userInterests);
    
    try {
      const response = await this.generateCompletion(batchPrompt, {
        temperature: 0.1,
        max_tokens: 500
      });

      return this.parseBatchResponse(response, tweets.length);
    } catch (error) {
      logger.logError('Batch analysis', error);
      // Return neutral scores for all tweets
      return tweets.map(() => ({
        score: 50,
        isSignal: false,
        reason: 'Batch analysis failed',
        confidence: 'error'
      }));
    }
  }

  buildBatchPrompt(tweets, userInterests) {
    const interestContext = userInterests.length > 0 
      ? `User interests: ${userInterests.join(', ')}\n\n` 
      : '';

    const tweetList = tweets.map((tweet, i) => 
      `Tweet ${i + 1}: "${tweet.text}"`
    ).join('\n\n');

    return `You are a tweet classifier. Analyze these tweets and rate each as high-signal (valuable) or low-signal/noise.

${interestContext}${tweetList}

Respond with a JSON array where each object has:
{
  "index": <tweet number>,
  "score": <0-100>,
  "reason": "<brief explanation>"
}`;
  }

  parseBatchResponse(response, expectedCount) {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const results = new Array(expectedCount).fill(null);
        
        parsed.forEach(item => {
          if (item.index && item.index <= expectedCount) {
            results[item.index - 1] = {
              score: Math.max(0, Math.min(100, item.score || 50)),
              isSignal: (item.score || 50) >= 70,
              reason: item.reason || 'No reason provided',
              confidence: 'llm'
            };
          }
        });

        // Fill any missing results
        return results.map(r => r || {
          score: 50,
          isSignal: false,
          reason: 'No analysis provided',
          confidence: 'error'
        });
      }
    } catch (error) {
      logger.logError('Parsing batch response', error);
    }

    return new Array(expectedCount).fill({
      score: 50,
      isSignal: false,
      reason: 'Batch parsing failed',
      confidence: 'error'
    });
  }
  async analyzeAccount(author, userPreferences = {}) {
    if (!author || !author.handle) {
      return {
        score: 50,
        reason: 'No author information available',
        confidence: 0,
        agentType: 'account'
      };
    }
    
    // Check cache first
    const cacheKey = `${author.handle}_${author.isVerified}_${author.isBlueVerified}`;
    const cached = this.accountCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      logger.debug(`Using cached score for ${author.handle}`, { score: cached.data.score });
      return { ...cached.data, fromCache: true };
    }
    
    const prompt = this.buildAccountPrompt(author, userPreferences);
    const requestId = `acc_${Date.now().toString(36)}`;
    
    console.log('\n=== ACCOUNT AGENT ANALYSIS ===');
    console.log(`Request ID: ${requestId}`);
    console.log(`Analyzing account: ${author.handle}`);
    console.log(`Display name: ${author.displayName}`);
    console.log(`Verified: ${author.isVerified ? 'Yes' : 'No'}`);
    console.log(`Blue checkmark: ${author.isBlueVerified ? 'Yes' : 'No'}`);
    
    try {
      const startTime = Date.now();
      
      console.log('\n--- ACCOUNT AGENT PROMPT ---');
      console.log(prompt);
      console.log('--- END PROMPT ---\n');
      
      const response = await this.generateCompletion(prompt, {
        temperature: 0.1,
        max_tokens: 100
      });
      
      const latency = Date.now() - startTime;
      
      console.log('--- ACCOUNT AGENT RAW RESPONSE ---');
      console.log(response);
      console.log('--- END RESPONSE ---\n');
      
      const parsed = this.parseAnalysisResponse(response, userPreferences.threshold || 70);
      parsed.agentType = 'account';
      
      console.log('--- ACCOUNT AGENT RESULT ---');
      console.log(`Score: ${parsed.score}`);
      console.log(`Is Signal: ${parsed.isSignal}`);
      console.log(`Reason: ${parsed.reason}`);
      console.log(`Confidence: ${parsed.confidence}`);
      console.log(`Latency: ${latency}ms`);
      console.log('=== END ACCOUNT AGENT ===\n');
      
      // Cache the result
      this.accountCache.set(cacheKey, {
        data: parsed,
        timestamp: Date.now()
      });
      
      // Clean old cache entries if cache gets too large
      if (this.accountCache.size > 1000) {
        const oldestKey = Array.from(this.accountCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        this.accountCache.delete(oldestKey);
      }
      
      return parsed;
    } catch (error) {
      console.error(`Account agent error (${requestId}):`, error.message);
      return {
        score: 50,
        isSignal: false,
        reason: 'Account analysis failed',
        confidence: 0,
        agentType: 'account'
      };
    }
  }
  
  async analyzeMedia(tweetData, userPreferences = {}) {
    const hasRelevantMedia = tweetData.hasMedia || tweetData.hasExternalLinks;
    
    if (!hasRelevantMedia) {
      console.log('\n=== MEDIA AGENT ANALYSIS ===');
      console.log('No media or links to analyze - using neutral score');
      console.log('=== END MEDIA AGENT ===\n');
      return {
        score: 50,
        reason: 'No media or links to analyze',
        confidence: 0.1,
        agentType: 'media'
      };
    }
    
    const prompt = this.buildMediaPrompt(tweetData, userPreferences);
    const requestId = `media_${Date.now().toString(36)}`;
    
    console.log('\n=== MEDIA AGENT ANALYSIS ===');
    console.log(`Request ID: ${requestId}`);
    console.log(`Media types: ${tweetData.mediaTypes?.join(', ') || 'none'}`);
    console.log(`Links found: ${tweetData.links?.length || 0}`);
    if (tweetData.links?.length > 0) {
      console.log(`Link domains: ${[...new Set(tweetData.links.map(l => l.domain))].join(', ')}`);
    }
    console.log(`Hashtags: ${tweetData.hashtags?.slice(0, 5).join(', ') || 'none'}`);
    
    try {
      const startTime = Date.now();
      
      console.log('\n--- MEDIA AGENT PROMPT ---');
      console.log(prompt);
      console.log('--- END PROMPT ---\n');
      
      const response = await this.generateCompletion(prompt, {
        temperature: 0.1,
        max_tokens: 100
      });
      
      const latency = Date.now() - startTime;
      
      console.log('--- MEDIA AGENT RAW RESPONSE ---');
      console.log(response);
      console.log('--- END RESPONSE ---\n');
      
      const parsed = this.parseAnalysisResponse(response, userPreferences.threshold || 70);
      parsed.agentType = 'media';
      
      console.log('--- MEDIA AGENT RESULT ---');
      console.log(`Score: ${parsed.score}`);
      console.log(`Is Signal: ${parsed.isSignal}`);
      console.log(`Reason: ${parsed.reason}`);
      console.log(`Confidence: ${parsed.confidence}`);
      console.log(`Latency: ${latency}ms`);
      console.log('=== END MEDIA AGENT ===\n');
      
      return parsed;
    } catch (error) {
      console.error(`Media agent error (${requestId}):`, error.message);
      return {
        score: 50,
        isSignal: false,
        reason: 'Media analysis failed',
        confidence: 0,
        agentType: 'media'
      };
    }
  }
  
  buildAccountPrompt(author, userPreferences = {}) {
    const { interests = [] } = userPreferences;
    const interestContext = interests.length > 0 
      ? `User interests: ${interests.join(', ')}\n\n`
      : '';
    
    return `You are analyzing a Twitter/X account to determine if they typically post high-signal content.

${interestContext}Account details:
- Handle: ${author.handle}
- Display name: ${author.displayName}
- Verified: ${author.isVerified ? 'Yes (legacy)' : 'No'}
- Blue checkmark: ${author.isBlueVerified ? 'Yes' : 'No'}

Rate this account's typical signal quality:

{
  "score": <0-100>,
  "reason": "<one sentence>",
  "confidence": <0.0-1.0>
}

Examples:
{"score": 90, "reason": "Established researcher or industry expert", "confidence": 0.9}
{"score": 20, "reason": "Spam or promotional account pattern", "confidence": 0.8}
{"score": 70, "reason": "Verified journalist from reputable outlet", "confidence": 0.75}
{"score": 30, "reason": "Anonymous account with clickbait username", "confidence": 0.7}`;
  }
  
  buildMediaPrompt(tweetData, userPreferences = {}) {
    const mediaInfo = [];
    
    if (tweetData.mediaTypes?.length > 0) {
      mediaInfo.push(`Media types: ${tweetData.mediaTypes.join(', ')}`);
    }
    
    if (tweetData.links?.length > 0) {
      const domains = [...new Set(tweetData.links.map(l => l.domain))];
      mediaInfo.push(`Link domains: ${domains.join(', ')}`);
    }
    
    if (tweetData.hashtags?.length > 0) {
      mediaInfo.push(`Hashtags: ${tweetData.hashtags.slice(0, 5).join(', ')}`);
    }
    
    return `You are analyzing media and metadata in a tweet to determine signal quality.

${mediaInfo.join('\n')}

Rate the media/metadata quality:

{
  "score": <0-100>,
  "reason": "<one sentence>",
  "confidence": <0.0-1.0>
}

Examples:
{"score": 95, "reason": "Links to academic papers or primary sources", "confidence": 0.95}
{"score": 15, "reason": "Clickbait domain with engagement bait hashtags", "confidence": 0.85}
{"score": 80, "reason": "High-quality video content with educational value", "confidence": 0.8}
{"score": 25, "reason": "Meme images with no informational content", "confidence": 0.75}`;
  }
  
  async aggregateResults(results, userPreferences = {}) {
    // Simple aggregation for now - can be made more sophisticated
    const validResults = Object.values(results).filter(r => r && r.score !== undefined);
    
    if (validResults.length === 0) {
      return {
        score: 50,
        isSignal: false,
        reason: 'All agents failed',
        confidence: 'multi-agent',
        agentScores: {}
      };
    }
    
    // Weight the scores based on confidence
    let totalWeight = 0;
    let weightedSum = 0;
    const agentScores = {};
    
    for (const [agentName, result] of Object.entries(results)) {
      if (result && result.score !== undefined) {
        const weight = result.confidence || 0.5;
        weightedSum += result.score * weight;
        totalWeight += weight;
        agentScores[agentName] = {
          score: result.score,
          reason: result.reason,
          confidence: result.confidence
        };
      }
    }
    
    const finalScore = Math.round(weightedSum / totalWeight);
    const threshold = userPreferences.threshold || 70;
    
    // Generate combined reason
    const reasons = [];
    if (results.account?.reason) reasons.push(`Account: ${results.account.reason}`);
    if (results.content?.reason) reasons.push(`Content: ${results.content.reason}`);
    if (results.media?.reason) reasons.push(`Media: ${results.media.reason}`);
    
    return {
      score: finalScore,
      isSignal: finalScore >= (100 - threshold),
      reason: reasons.join('; '),
      confidence: 'multi-agent',
      agentScores,
      agentCount: validResults.length
    };
  }
}

export default OllamaClient;