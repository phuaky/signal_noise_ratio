import fetch from 'node-fetch';
import logger from './logger.js';

class OllamaClient {
  constructor(host = 'http://localhost:11434', debug = false) {
    this.host = host;
    this.defaultModel = 'llama3.2:3b'; // Using Llama 3.2 for better JSON compliance
    this.accountCache = new Map(); // Cache for account scores
    this.cacheTimeout = 3600000; // 1 hour cache
    this.debug = debug || process.env.OLLAMA_DEBUG === 'true'; // Enable debug via env var
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
    // Main analysis method - content only
    return this.analyzeContent(tweetText, userPreferences);
  }
  
  // REMOVED: Multi-agent analysis - now using content-only
  /*
  async analyzeWithMultipleAgents(tweetData, userPreferences = {}) {
    const analysisId = `multi_${Date.now().toString(36)}`;
    
    if (this.debug) {
      console.log(`[Multi-Agent] Starting analysis ${analysisId} for @${tweetData.author?.handle || 'unknown'}`);
    }
    
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
    
    if (this.debug) {
      console.log(`[Multi-Agent] Results:`);
      if (results.account) console.log(`  Account: ${results.account.score} (${results.account.reason})`);
      if (results.content) console.log(`  Content: ${results.content.score} (${results.content.reason})`);
      if (results.media) console.log(`  Media: ${results.media.score} (${results.media.reason})`);
    }
    
    // Aggregate results
    const aggregated = await this.aggregateResults(results, userPreferences);
    
    if (this.debug) {
      console.log(`[Multi-Agent] Final: Score=${aggregated.score}, Signal=${aggregated.isSignal}, Time=${parallelTime}ms`);
    }
    
    return aggregated;
  }
  */
  
  async analyzeContent(tweetText, userPreferences = {}) {
    const prompt = this.buildAnalysisPrompt(tweetText, userPreferences);
    const requestId = `content_${Date.now().toString(36)}`;
    
    if (this.debug) {
      console.log(`[Content Agent] Analyzing tweet (${requestId})`);
    }
    
    try {
      const startTime = Date.now();
      
      if (this.debug) {
        console.log(`[Content Agent] Sending prompt...`);
      }
      
      const response = await this.generateCompletion(prompt, {
        temperature: 0.1,
        max_tokens: 100
      });
      
      const latency = Date.now() - startTime;
      
      // Log raw response only in debug mode
      if (this.debug) {
        console.log(`[Content Agent] Response received: ${response.substring(0, 100)}...`);
      }

      const threshold = userPreferences.threshold || 70;
      const parsed = this.parseAnalysisResponse(response, threshold);
      parsed.agentType = 'content';
      
      if (this.debug) {
        console.log(`[Content Agent] Score=${parsed.score}, Category=${parsed.category}, Signal=${parsed.isSignal}, Latency=${latency}ms`);
      }
      
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
    // Streamlined prompt with pattern matching
    return `You are a tech content filter. Rate tweets 0-100.

SIGNAL PATTERNS (80-100):
• AI/ML/LLM research, models, tools
• Startups, YC, funding, building
• Code, APIs, technical tutorials
• Open source, developer tools

NOISE PATTERNS (0-30):
• Entertainment, celebrity, lifestyle
• Food, fashion, dating, sports
• Personal drama, political rants

Tweet: "${tweetText.substring(0, 500)}"

Respond with JSON only:
{"score": <0-100>, "reason": "<10 words max>", "confidence": <0.0-1.0>}

Examples:
"Shipped YC-backed AI coding assistant with novel attention mechanism"
{"score": 95, "reason": "YC startup launching AI developer tool", "confidence": 0.95}

"Celebrity drama at red carpet event last night"
{"score": 5, "reason": "Entertainment gossip content", "confidence": 0.99}

"Thread: Scaling API to 1M req/s with Rust"
{"score": 90, "reason": "Technical infrastructure deep-dive", "confidence": 0.9}`;
  }

  parseAnalysisResponse(response, threshold = 70) {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const score = Math.max(0, Math.min(100, parsed.score || 50));
        
        // Simplified scoring with confidence levels
        let category;
        if (score >= 80) {
          category = 'high-signal';
        } else if (score >= threshold) {
          category = 'signal';
        } else if (score >= 40) {
          category = 'medium';
        } else {
          category = 'noise';
        }
        
        return {
          score,
          isSignal: score >= threshold, // Direct threshold comparison
          category, // New field for multi-level classification
          reason: parsed.reason || 'No reason provided',
          confidence: parsed.confidence || 0.5
        };
      }
    } catch (error) {
      // Try alternative parsing for common patterns
      const scoreMatch = response.match(/"score"\s*:\s*(\d+)/);
      const reasonMatch = response.match(/"reason"\s*:\s*"([^"]*)"/);
      const confidenceMatch = response.match(/"confidence"\s*:\s*([\d.]+)/);
      
      if (scoreMatch) {
        const score = Math.max(0, Math.min(100, parseInt(scoreMatch[1])));
        
        let category;
        if (score >= 80) {
          category = 'high-signal';
        } else if (score >= threshold) {
          category = 'signal';
        } else if (score >= 40) {
          category = 'medium';
        } else {
          category = 'noise';
        }
        
        return {
          score,
          isSignal: score >= threshold,
          category,
          reason: reasonMatch ? reasonMatch[1] : 'Partial parse',
          confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5
        };
      }
      
      logger.logError('Parsing LLM response', error);
    }

    // Fallback parsing
    return {
      score: 50,
      isSignal: false,
      category: 'medium',
      reason: 'Could not parse response',
      confidence: 0
    };
  }

  async analyzeTweetBatch(tweets, userPreferences = {}) {
    // Improved batch analysis with pre-filtering
    const results = [];
    const needsLLM = [];
    
    // First pass: apply heuristics
    for (let i = 0; i < tweets.length; i++) {
      const tweet = tweets[i];
      const quickResult = this.quickHeuristicCheck(tweet.text);
      
      if (quickResult && quickResult.confidence >= 0.9) {
        results[i] = quickResult;
      } else {
        needsLLM.push({ index: i, tweet });
        results[i] = null; // Placeholder
      }
    }
    
    // Second pass: batch LLM for ambiguous tweets
    if (needsLLM.length > 0) {
      const batchPrompt = this.buildCompactBatchPrompt(needsLLM, userPreferences);
      
      try {
        const response = await this.generateCompletion(batchPrompt, {
          temperature: 0.1,
          max_tokens: 20 * needsLLM.length // ~20 tokens per tweet
        });
        
        const llmResults = this.parseBatchResponse(response, needsLLM.length, userPreferences.threshold || 70);
        
        // Merge LLM results
        for (let i = 0; i < needsLLM.length; i++) {
          results[needsLLM[i].index] = llmResults[i];
        }
      } catch (error) {
        logger.logError('Batch LLM analysis', error);
        // Fill with medium confidence scores
        for (const item of needsLLM) {
          results[item.index] = {
            score: 50,
            isSignal: false,
            category: 'medium',
            reason: 'Analysis error',
            confidence: 0
          };
        }
      }
    }
    
    return results;
  }
  
  quickHeuristicCheck(text) {
    const lower = text.toLowerCase();
    
    // Very high confidence signals
    if (lower.includes('yc') || lower.includes('anthropic') || lower.includes('github.com')) {
      return {
        score: 90,
        isSignal: true,
        category: 'high-signal',
        reason: 'Tech indicator',
        confidence: 0.95
      };
    }
    
    // Very high confidence noise
    if (lower.includes('celebrity') || lower.includes('recipe') || lower.includes('skincare')) {
      return {
        score: 10,
        isSignal: false,
        category: 'noise',
        reason: 'Lifestyle content',
        confidence: 0.95
      };
    }
    
    return null; // Needs LLM
  }

  buildCompactBatchPrompt(tweetsWithIndex, userPreferences) {
    const tweetList = tweetsWithIndex.map((item, i) => 
      `${i + 1}: "${item.tweet.text.substring(0, 200)}"`
    ).join('\n');

    return `Rate tech relevance (0-100):
${tweetList}

JSON array only:
[{"i":1,"s":<score>,"r":"<5 words>"}...]`;
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

  parseBatchResponse(response, expectedCount, threshold = 70) {
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const results = new Array(expectedCount).fill(null);
        
        parsed.forEach((item, idx) => {
          const index = item.i || item.index || (idx + 1);
          const score = Math.max(0, Math.min(100, item.s || item.score || 50));
          
          // Determine category
          let category;
          if (score >= 80) {
            category = 'high-signal';
          } else if (score >= threshold) {
            category = 'signal';
          } else if (score >= 40) {
            category = 'medium';
          } else {
            category = 'noise';
          }
          
          if (index <= expectedCount) {
            results[index - 1] = {
              score,
              isSignal: score >= threshold,
              category,
              reason: item.r || item.reason || 'Batch analysis',
              confidence: 0.8
            };
          }
        });

        // Fill any missing results
        return results.map(r => r || {
          score: 50,
          isSignal: false,
          category: 'medium',
          reason: 'No analysis provided',
          confidence: 0
        });
      }
    } catch (error) {
      logger.logError('Parsing batch response', error);
    }

    return new Array(expectedCount).fill({
      score: 50,
      isSignal: false,
      category: 'medium',
      reason: 'Batch parsing failed',
      confidence: 0
    });
  }
  // REMOVED: Account analysis - no longer needed
  /*
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
    
    if (this.debug) {
      console.log(`[Account Agent] Analyzing @${author.handle} (${requestId})`);
    }
    
    try {
      const startTime = Date.now();
      
      if (this.debug) {
        console.log(`[Account Agent] Sending prompt...`);
      }
      
      const response = await this.generateCompletion(prompt, {
        temperature: 0.1,
        max_tokens: 100
      });
      
      const latency = Date.now() - startTime;
      
      if (this.debug) {
        console.log(`[Account Agent] Response received: ${response.substring(0, 100)}...`);
      }
      
      const parsed = this.parseAnalysisResponse(response, userPreferences.threshold || 70);
      parsed.agentType = 'account';
      
      if (this.debug) {
        console.log(`[Account Agent] Score=${parsed.score}, Signal=${parsed.isSignal}, Latency=${latency}ms`);
      }
      
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
  */
  
  // REMOVED: Media analysis - no longer needed
  /*
  async analyzeMedia(tweetData, userPreferences = {}) {
    const hasRelevantMedia = tweetData.hasMedia || tweetData.hasExternalLinks;
    
    if (!hasRelevantMedia) {
      if (this.debug) {
        console.log('[Media Agent] No media/links to analyze');
      }
      return {
        score: 50,
        reason: 'No media or links to analyze',
        confidence: 0.1,
        agentType: 'media'
      };
    }
    
    const prompt = this.buildMediaPrompt(tweetData, userPreferences);
    const requestId = `media_${Date.now().toString(36)}`;
    
    if (this.debug) {
      console.log(`[Media Agent] Analyzing media (${requestId})`);
    }
    
    try {
      const startTime = Date.now();
      
      if (this.debug) {
        console.log(`[Media Agent] Sending prompt...`);
      }
      
      const response = await this.generateCompletion(prompt, {
        temperature: 0.1,
        max_tokens: 100
      });
      
      const latency = Date.now() - startTime;
      
      if (this.debug) {
        console.log(`[Media Agent] Response received: ${response.substring(0, 100)}...`);
      }
      
      const parsed = this.parseAnalysisResponse(response, userPreferences.threshold || 70);
      parsed.agentType = 'media';
      
      if (this.debug) {
        console.log(`[Media Agent] Score=${parsed.score}, Signal=${parsed.isSignal}, Latency=${latency}ms`);
      }
      
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
  */
  
  // REMOVED: Account prompt - no longer needed
  /*
  buildAccountPrompt(author, userPreferences = {}) {
    return `You are filtering Twitter accounts for a tech professional interested in startups and AI.

HIGH SIGNAL ACCOUNTS (score 80-100):
- Founders, CTOs, technical co-founders
- AI/ML researchers, engineers at AI companies
- YC partners, alumni, portfolio founders
- Developers sharing code and technical content
- VCs focused on deep tech and AI
- Authors writing about network states, future of tech

NOISE ACCOUNTS (score 0-30):
- Entertainment reporters, gossip accounts
- Lifestyle influencers, fashion bloggers
- Food/cooking personalities
- Political commentators (unless tech policy)
- Meme accounts, joke accounts
- Promotional/marketing spam accounts

Account: ${author.handle}
Name: ${author.displayName}
Verified: ${author.isVerified ? 'Yes (legacy)' : 'No'}
Blue check: ${author.isBlueVerified ? 'Yes' : 'No'}

QUICK HEURISTICS:
- Handle contains "AI", "ML", "Dev", "Tech", "Founder" → likely HIGH SIGNAL
- Bio mentions YC, startup, building, shipping → likely HIGH SIGNAL
- Name includes "Coach", "Guru", "Influencer" → likely NOISE
- Entertainment/lifestyle keywords → definitely NOISE

Output ONLY valid JSON, no other text or tags:
{
  "score": <0-100>,
  "reason": "<specific reason based on account type>",
  "confidence": <0.0-1.0>
}
DO NOT include any thinking, explanations, or XML tags. ONLY the JSON object.

Examples:
@sama (Sam Altman, CEO of OpenAI)
{"score": 100, "reason": "OpenAI CEO, YC former president, AI leader", "confidence": 0.99}

@CelebGossip247
{"score": 0, "reason": "Entertainment gossip account", "confidence": 0.99}

@indie_hacker_bob (Bob Smith, Building in public)
{"score": 85, "reason": "Indie founder sharing building journey", "confidence": 0.85}

@paulg (Paul Graham, YC founder)
{"score": 100, "reason": "YC founder, startup wisdom and essays", "confidence": 0.99}

@FoodieInfluencer (Lifestyle & Recipes)
{"score": 5, "reason": "Food and lifestyle content creator", "confidence": 0.95}`;
  }
  */
  
  // REMOVED: Media prompt - no longer needed
  /*
  buildMediaPrompt(tweetData, userPreferences = {}) {
    const domains = [...new Set(tweetData.links?.map(l => l.domain) || [])];
    const mediaTypes = tweetData.mediaTypes || [];
    const hashtags = tweetData.hashtags || [];
    
    return `Analyze the media/links in this tweet and rate their tech relevance.

Tweet media information:
${mediaTypes.length > 0 ? `- Media types: ${mediaTypes.join(', ')}` : '- No media attached'}
${domains.length > 0 ? `- External links: ${domains.join(', ')}` : '- No external links'}
${hashtags.length > 0 ? `- Hashtags: ${hashtags.slice(0, 5).join(', ')}` : '- No hashtags'}

Rate based on these criteria:
HIGH SIGNAL (80-100): GitHub, GitLab, arXiv, YC/HN, AI companies, tech blogs, code content
NOISE (0-30): Instagram, TikTok, entertainment sites, recipes, lifestyle, sports

Respond with ONLY this JSON format:
{
  "score": <0-100>,
  "reason": "<specific reason based on media type>",
  "confidence": <0.0-1.0>
}
DO NOT include any thinking, explanations, or XML tags. ONLY the JSON object.

Examples:
Links to: github.com, arxiv.org
{"score": 95, "reason": "Code repository and research paper links", "confidence": 0.95}

Media: video, Links to: tiktok.com
{"score": 10, "reason": "TikTok video likely lifestyle content", "confidence": 0.9}

Links to: ycombinator.com
{"score": 90, "reason": "Hacker News discussion likely technical", "confidence": 0.9}

No media, No external links
{"score": 50, "reason": "No media to evaluate, neutral score", "confidence": 0.5}

Links to: instagram.com, Hashtags: #food, #recipe
{"score": 5, "reason": "Instagram food/lifestyle content", "confidence": 0.95}`;
  }
  */
  
  // REMOVED: Aggregation - no longer needed with single agent
  /*
  async aggregateResults(results, userPreferences = {}) {
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
    
    // AGGRESSIVE FILTERING - if ANY agent detects noise (score < 30), it's noise
    const minScore = Math.min(...validResults.map(r => r.score));
    const agentScores = {};
    
    // Build agent scores object
    for (const [agentName, result] of Object.entries(results)) {
      if (result && result.score !== undefined) {
        agentScores[agentName] = {
          score: result.score,
          reason: result.reason,
          confidence: result.confidence
        };
      }
    }
    
    // If ANY agent says it's noise (score < 30), mark as noise
    if (minScore < 30) {
      // Find which agent(s) flagged it as noise
      const noiseReasons = [];
      if (results.account?.score < 30) noiseReasons.push(`Account: ${results.account.reason}`);
      if (results.content?.score < 30) noiseReasons.push(`Content: ${results.content.reason}`);
      if (results.media?.score < 30) noiseReasons.push(`Media: ${results.media.reason}`);
      
      return {
        score: minScore,
        isSignal: false,
        reason: noiseReasons.join('; ') || 'Detected as noise content',
        confidence: 'multi-agent',
        agentScores,
        agentCount: validResults.length
      };
    }
    
    // Otherwise, use weighted average for signal content
    let totalWeight = 0;
    let weightedSum = 0;
    
    for (const result of validResults) {
      const weight = result.confidence || 0.5;
      weightedSum += result.score * weight;
      totalWeight += weight;
    }
    
    const finalScore = Math.round(weightedSum / totalWeight);
    
    // Use stricter threshold: 80+ is signal (since we're focused on tech content)
    const threshold = 20; // This means score >= 80 is signal
    
    // Generate combined reason for signal content
    const reasons = [];
    if (results.account?.reason) reasons.push(`Account: ${results.account.reason}`);
    if (results.content?.reason) reasons.push(`Content: ${results.content.reason}`);
    if (results.media?.reason) reasons.push(`Media: ${results.media.reason}`);
    
    return {
      score: finalScore,
      isSignal: finalScore >= (100 - threshold), // Score >= 80 is signal
      reason: reasons.join('; '),
      confidence: 'multi-agent',
      agentScores,
      agentCount: validResults.length
    };
  }
  */
}

export default OllamaClient;