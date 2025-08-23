// Signal detection algorithm
class TweetAnalyzer {
  constructor() {
    this.settings = {
      threshold: 30,
      useAI: false,
      apiKey: '',
      useLocalLLM: false,
      useCategoryWeights: true
    };
    
    // Load settings
    this.loadSettings();
    
    // Initialize LLM service if available
    this.llmService = window.LLMService ? new window.LLMService() : null;
    
    // Initialize caches
    this.authorCache = new Map(); // Cache author scores
    this.patternCache = new Map(); // Cache pattern analysis results
    this.cacheTimeout = 3600000; // 1 hour cache
    
    // Default heuristic weights
    this.defaultWeights = {
      hasMedia: 0.15,
      hasLinks: 0.20,
      isThread: 0.25,
      textLength: 0.15,
      engagementRatio: 0.10,
      isVerified: 0.05,
      hasHashtags: -0.05,
      isReply: -0.05,
      capsRatio: -0.15,
      emojiDensity: -0.10
    };
    
    // Category-specific weights (will be loaded from training data)
    this.categoryWeights = {};
    
    // Current weights (either default or category-specific)
    this.weights = { ...this.defaultWeights };
  }

  async loadSettings() {
    const stored = await chrome.storage.local.get([
      'threshold', 'useAI', 'apiKey', 'useLocalLLM', 
      'interests', 'signalPatterns', 'noisePatterns'
    ]);
    Object.assign(this.settings, stored);
    
    // Parse user preferences
    this.userPreferences = {
      interests: stored.interests ? stored.interests.split('\n').filter(i => i.trim()) : [],
      signalPatterns: stored.signalPatterns ? stored.signalPatterns.split('\n').filter(i => i.trim()) : [],
      noisePatterns: stored.noisePatterns ? stored.noisePatterns.split('\n').filter(i => i.trim()) : [],
      threshold: stored.threshold || 30
    };
  }

  async analyzeTweet(tweetElement, options = {}) {
    const tweetData = this.extractTweetData(tweetElement);
    
    if (window.SNR_DEBUG) {
      extLog.debug('Analyzing tweet', {
        text: tweetData.text.substring(0, 100) + (tweetData.text.length > 100 ? '...' : ''),
        hasMedia: tweetData.hasMedia,
        hasLinks: tweetData.hasExternalLinks,
        isThread: tweetData.isThread,
        isVerified: tweetData.isVerified,
        metrics: tweetData.metrics
      });
    }
    
    // Check author cache first
    const authorHandle = tweetData.author?.handle;
    if (authorHandle) {
      const cachedAuthor = this.getCachedAuthorScore(authorHandle);
      if (cachedAuthor) {
        if (window.SNR_DEBUG) {
          extLog.debug('Using cached author score', {
            author: authorHandle,
            score: cachedAuthor.score,
            category: cachedAuthor.category
          });
        }
        return { ...cachedAuthor, fromCache: true };
      }
    }
    
    // Check pattern cache for similar content
    const contentHash = this.hashContent(tweetData.text);
    const cachedPattern = this.patternCache.get(contentHash);
    if (cachedPattern && Date.now() - cachedPattern.timestamp < this.cacheTimeout) {
      if (window.SNR_DEBUG) {
        extLog.debug('Using cached pattern analysis', {
          score: cachedPattern.data.score,
          category: cachedPattern.data.category
        });
      }
      return { ...cachedPattern.data, fromCache: true };
    }
    
    // Quick heuristic pre-filter for obvious signals/noise
    const heuristicResult = this.quickHeuristicFilter(tweetData);
    if (heuristicResult && heuristicResult.confidence >= 0.9) {
      if (window.SNR_DEBUG) {
        extLog.debug('Heuristic filter result', {
          score: heuristicResult.score,
          category: heuristicResult.category,
          reason: heuristicResult.reason
        });
      }
      
      // Cache the result
      this.cacheAnalysisResult(tweetData, heuristicResult);
      return heuristicResult;
    }
    
    // Use LLM for ambiguous content
    if (this.settings.useLocalLLM && this.llmService) {
      if (window.SNR_DEBUG) extLog.debug('Attempting local LLM analysis');
      // Pass full tweet data for multi-agent analysis
      const llmResult = await this.llmService.analyzeTweet(tweetData.text, this.userPreferences, tweetData);
      if (llmResult) {
        const methodUsed = llmResult.agentCount ? `Local LLM (${llmResult.agentCount} agents)` : 'Local LLM';
        
        if (window.SNR_DEBUG) {
          extLog.debug('Analysis complete', {
            method: methodUsed,
            score: llmResult.score,
            isSignal: llmResult.isSignal,
            category: llmResult.category,
            confidence: llmResult.confidence,
            reason: llmResult.reason,
            agentScores: llmResult.agentScores
          });
        }
        
        // Cache the result
        this.cacheAnalysisResult(tweetData, llmResult);
        return llmResult;
      } else {
        if (window.SNR_DEBUG) extLog.debug('Local LLM not available - skipping analysis');
        return null; // No analysis if LLM is not available
      }
    }
    
    // No LLM configured or available - return null
    if (window.SNR_DEBUG) extLog.debug('Local LLM not enabled - no analysis performed');
    return null;
  }
  
  quickHeuristicFilter(tweetData) {
    const text = tweetData.text.toLowerCase();
    const author = tweetData.author?.handle?.toLowerCase() || '';
    
    // High-confidence signal patterns
    const signalKeywords = [
      'yc', 'y combinator', 'ycombinator',
      'claude', 'anthropic', 'openai', 'gpt-4', 'llm',
      'shipped', 'launched', 'built', 'deployed',
      'github.com', 'arxiv.org',
      'api', 'sdk', 'framework',
      'seed round', 'series a', 'funding',
      'open source', 'oss'
    ];
    
    // High-confidence noise patterns
    const noiseKeywords = [
      'celebrity', 'red carpet', 'gossip', 'scandal',
      'recipe', 'cooking', 'baking', 'ingredients',
      'skincare', 'makeup', 'fashion', 'outfit',
      'dating', 'relationship', 'boyfriend', 'girlfriend',
      'horoscope', 'zodiac', 'astrology'
    ];
    
    // Check for strong signal indicators
    const hasStrongSignal = signalKeywords.some(keyword => text.includes(keyword));
    const hasCodeBlock = text.includes('```') || text.includes('function') || text.includes('const ');
    const hasGithubLink = tweetData.links?.some(l => l.domain === 'github.com');
    const hasArxivLink = tweetData.links?.some(l => l.domain === 'arxiv.org');
    
    if (hasStrongSignal || hasCodeBlock || hasGithubLink || hasArxivLink) {
      return {
        score: 90,
        isSignal: true,
        category: 'high-signal',
        reason: 'Strong tech/startup indicators',
        confidence: 0.95,
        method: 'heuristic'
      };
    }
    
    // Check for strong noise indicators
    const hasStrongNoise = noiseKeywords.some(keyword => text.includes(keyword));
    const isLifestyleContent = text.includes('my morning routine') || 
                               text.includes('life hack') ||
                               text.includes('hot take');
    
    if (hasStrongNoise || isLifestyleContent) {
      return {
        score: 10,
        isSignal: false,
        category: 'noise',
        reason: 'Lifestyle/entertainment content',
        confidence: 0.95,
        method: 'heuristic'
      };
    }
    
    // Check author reputation (if we have cached data)
    const knownTechAccounts = ['sama', 'paulg', 'elonmusk', 'patrickc', 'balajis'];
    const knownNoiseAccounts = ['celebgossip', 'foodnetwork', 'espn'];
    
    if (knownTechAccounts.some(acc => author.includes(acc))) {
      return {
        score: 85,
        isSignal: true,
        category: 'high-signal',
        reason: 'Known tech leader account',
        confidence: 0.9,
        method: 'heuristic'
      };
    }
    
    if (knownNoiseAccounts.some(acc => author.includes(acc))) {
      return {
        score: 5,
        isSignal: false,
        category: 'noise',
        reason: 'Known entertainment account',
        confidence: 0.9,
        method: 'heuristic'
      };
    }
    
    // No strong signals either way - let LLM decide
    return null;
  }
  
  async loadCategoryWeights(category) {
    try {
      // Request category-specific weights from background script
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'getCategoryWeights',
          category: category
        }, (response) => {
          if (chrome.runtime.lastError) {
            extLog.warn('Failed to get category weights', { error: chrome.runtime.lastError.message });
            resolve(null);
          } else {
            resolve(response);
          }
        });
      });
      
      if (response && response.weights) {
        // Merge category weights with defaults
        this.weights = { ...this.defaultWeights, ...response.weights };
      }
    } catch (error) {
      extLog.error('Failed to load category weights', { error: error.message, stack: error.stack });
      // Fallback to default weights
      this.weights = { ...this.defaultWeights };
    }
  }

  extractTweetData(element) {
    // Extract tweet text
    const textElement = element.querySelector('[data-testid="tweetText"]');
    const text = textElement ? textElement.innerText : '';
    
    // Extract author information
    const authorElement = element.querySelector('[data-testid="User-Name"]');
    let author = {
      username: '',
      displayName: '',
      handle: '',
      isVerified: false,
      isBlueVerified: false
    };
    
    if (authorElement) {
      // Extract display name
      const displayNameEl = authorElement.querySelector('span');
      author.displayName = displayNameEl ? displayNameEl.innerText : '';
      
      // Extract handle
      const handleEl = authorElement.querySelector('[tabindex="-1"] span');
      if (handleEl && handleEl.innerText.startsWith('@')) {
        author.handle = handleEl.innerText;
        author.username = handleEl.innerText.substring(1); // Remove @
      }
      
      // Check verification types
      author.isVerified = element.querySelector('[data-testid="icon-verified"]') !== null;
      author.isBlueVerified = element.querySelector('[aria-label*="Verified account"]') !== null;
    }
    
    // Extract metrics with more detail
    const metrics = {
      likes: this.extractMetric(element, '[data-testid="like"]'),
      retweets: this.extractMetric(element, '[data-testid="retweet"]'),
      replies: this.extractMetric(element, '[data-testid="reply"]'),
      views: this.extractMetric(element, '[href$="/analytics"]')
    };
    
    // Extract media information
    const mediaElements = {
      photos: element.querySelectorAll('[data-testid="tweetPhoto"]'),
      videos: element.querySelectorAll('[data-testid="videoPlayer"]'),
      cards: element.querySelectorAll('[data-testid="card.wrapper"]')
    };
    
    const hasMedia = mediaElements.photos.length > 0 || 
                    mediaElements.videos.length > 0 || 
                    mediaElements.cards.length > 0;
    
    const mediaTypes = [];
    if (mediaElements.photos.length > 0) mediaTypes.push('photo');
    if (mediaElements.videos.length > 0) mediaTypes.push('video');
    if (mediaElements.cards.length > 0) mediaTypes.push('link-preview');
    
    // Extract links with more detail
    const linkElements = element.querySelectorAll('a[href^="http"]:not([href*="twitter.com"]):not([href*="x.com"])');
    const links = Array.from(linkElements).map(link => ({
      url: link.href,
      text: link.innerText,
      domain: new URL(link.href).hostname.replace('www.', '')
    }));
    
    const hasExternalLinks = links.length > 0;
    
    // Extract hashtags and mentions
    const hashtags = Array.from(element.querySelectorAll('[href^="/hashtag/"]')).map(el => el.innerText);
    const mentions = Array.from(element.querySelectorAll('[href^="/"][href*="@"]:not([data-testid])')).map(el => el.innerText);
    
    // Check if part of thread
    const isThread = element.querySelector('[data-testid="threadline"]') !== null;
    
    // Check if reply
    const replyingToElement = element.querySelector('[dir="ltr"] > span > span');
    const isReply = replyingToElement && replyingToElement.innerText.includes('Replying to');
    
    // Check if quote tweet
    const isQuoteTweet = element.querySelector('[data-testid="tweet"] [data-testid="tweet"]') !== null;
    
    return {
      text,
      author,
      metrics,
      hasMedia,
      mediaTypes,
      hasExternalLinks,
      links,
      hashtags,
      mentions,
      isThread,
      isVerified: author.isVerified,
      isReply,
      isQuoteTweet,
      element
    };
  }

  extractMetric(element, selector) {
    const metricElement = element.querySelector(selector);
    if (!metricElement) return 0;
    
    const ariaLabel = metricElement.getAttribute('aria-label');
    if (!ariaLabel) {
      // Try to get text content for views
      const textContent = metricElement.innerText || '';
      const match = textContent.match(/([\d.]+[KMB]?)/);
      if (match) {
        return this.parseMetricValue(match[1]);
      }
      return 0;
    }
    
    const match = ariaLabel.match(/([\d,]+)/);
    return match ? parseInt(match[1].replace(/,/g, '')) : 0;
  }
  
  parseMetricValue(value) {
    // Parse values like "1.2K", "2.5M", etc.
    const num = parseFloat(value);
    if (value.endsWith('K')) return Math.round(num * 1000);
    if (value.endsWith('M')) return Math.round(num * 1000000);
    if (value.endsWith('B')) return Math.round(num * 1000000000);
    return Math.round(num);
  }

  // Cache helper methods
  getCachedAuthorScore(handle) {
    const cached = this.authorCache.get(handle);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }
  
  hashContent(text) {
    // Simple hash for pattern matching (first 100 chars + length)
    const normalized = text.toLowerCase().trim().substring(0, 100);
    return `${normalized.length}_${normalized}`;
  }
  
  cacheAnalysisResult(tweetData, result) {
    // Cache by author if high confidence
    if (tweetData.author?.handle && result.confidence >= 0.8) {
      this.authorCache.set(tweetData.author.handle, {
        data: {
          score: result.score,
          isSignal: result.isSignal,
          category: result.category,
          reason: `Cached from: ${result.reason}`,
          confidence: result.confidence * 0.9 // Slightly reduce confidence for cached results
        },
        timestamp: Date.now()
      });
      
      // Clean old cache entries if too large
      if (this.authorCache.size > 500) {
        const oldestKey = Array.from(this.authorCache.entries())
          .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
        this.authorCache.delete(oldestKey);
      }
    }
    
    // Cache by content pattern
    const contentHash = this.hashContent(tweetData.text);
    this.patternCache.set(contentHash, {
      data: result,
      timestamp: Date.now()
    });
    
    // Clean pattern cache if too large
    if (this.patternCache.size > 1000) {
      const oldestKey = Array.from(this.patternCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.patternCache.delete(oldestKey);
    }
  }
}

// Export for use in content.js
window.TweetAnalyzer = TweetAnalyzer;