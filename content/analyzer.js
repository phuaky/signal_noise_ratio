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
    
    // If a category is provided, use category-specific weights
    if (options.category && this.settings.useCategoryWeights) {
      if (window.SNR_DEBUG) extLog.debug('Loading category weights', { category: options.category });
      await this.loadCategoryWeights(options.category);
    }
    
    let result;
    let methodUsed;
    
    // Try local LLM first if enabled
    if (this.settings.useLocalLLM && this.llmService) {
      if (window.SNR_DEBUG) extLog.debug('Attempting local LLM analysis');
      // Pass full tweet data for multi-agent analysis
      const llmResult = await this.llmService.analyzeTweet(tweetData.text, this.userPreferences, tweetData);
      if (llmResult) {
        result = llmResult;
        methodUsed = llmResult.agentCount ? `Local LLM (${llmResult.agentCount} agents)` : 'Local LLM';
      } else {
        if (window.SNR_DEBUG) extLog.debug('Local LLM failed, trying next method');
      }
    }
    
    // Then try cloud AI if enabled and LLM didn't work
    if (!result && this.settings.useAI && this.settings.apiKey) {
      if (window.SNR_DEBUG) extLog.debug('Attempting cloud AI analysis');
      result = await this.analyzeWithAI(tweetData);
      methodUsed = 'Cloud AI';
    }
    
    // Default to heuristics if nothing else worked
    if (!result) {
      if (window.SNR_DEBUG) extLog.debug('Using heuristic analysis');
      result = this.analyzeWithHeuristics(tweetData);
      methodUsed = 'Heuristics';
    }
    
    if (window.SNR_DEBUG) {
      extLog.debug('Analysis complete', {
        method: methodUsed,
        score: result.score,
        isSignal: result.isSignal,
        confidence: result.confidence,
        reason: result.reason,
        agentScores: result.agentScores
      });
    }
    
    return result;
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

  analyzeWithHeuristics(data) {
    let score = 50; // Start at neutral
    
    // Text analysis
    const textLength = data.text.length;
    if (textLength > 280) {
      score += this.weights.textLength * 20;
    } else if (textLength < 50) {
      score -= this.weights.textLength * 10;
    }
    
    // Check for all caps
    const capsRatio = this.calculateCapsRatio(data.text);
    if (capsRatio > 0.5) {
      score += this.weights.capsRatio * 30;
    }
    
    // Emoji density
    const emojiDensity = this.calculateEmojiDensity(data.text);
    if (emojiDensity > 0.2) {
      score += this.weights.emojiDensity * 20;
    }
    
    // Media and links
    if (data.hasMedia) score += this.weights.hasMedia * 20;
    if (data.hasExternalLinks) score += this.weights.hasLinks * 30;
    if (data.isThread) score += this.weights.isThread * 40;
    if (data.isVerified) score += this.weights.isVerified * 10;
    if (data.isReply) score += this.weights.isReply * 10;
    
    // Engagement ratio (if metrics available)
    const totalEngagement = data.metrics.likes + data.metrics.retweets + data.metrics.replies;
    if (totalEngagement > 100) {
      const engagementScore = Math.min(20, totalEngagement / 50);
      score += this.weights.engagementRatio * engagementScore;
    }
    
    // Check for hashtag spam
    const hashtagCount = (data.text.match(/#/g) || []).length;
    if (hashtagCount > 3) {
      score += this.weights.hasHashtags * (hashtagCount * 5);
    }
    
    // Noise patterns
    const noisePatterns = [
      /breaking:/i,
      /BREAKING:/,
      /🚨/,
      /RT if/i,
      /Like if/i,
      /ratio/i,
      /L \+ ratio/i,
      /mid /i,
      /cringe/i,
      /based/i,
      /cope/i,
      /seethe/i
    ];
    
    const hasNoisePattern = noisePatterns.some(pattern => pattern.test(data.text));
    if (hasNoisePattern) {
      score -= 20;
    }
    
    // Signal patterns
    const signalPatterns = [
      /study|research|paper|analysis/i,
      /according to|data shows|report/i,
      /thread:/i,
      /explained:/i,
      /TIL:|Today I learned/i,
      /interesting|insight|perspective/i
    ];
    
    const hasSignalPattern = signalPatterns.some(pattern => pattern.test(data.text));
    if (hasSignalPattern) {
      score += 15;
    }
    
    // Ensure score is between 0 and 100
    score = Math.max(0, Math.min(100, score));
    
    // Generate reasoning for heuristic analysis
    let reasons = [];
    if (data.isThread) reasons.push('part of a thread');
    if (data.hasExternalLinks) reasons.push('contains external links');
    if (data.hasMedia) reasons.push('includes media');
    if (capsRatio > 0.5) reasons.push('excessive caps');
    if (emojiDensity > 0.2) reasons.push('high emoji density');
    if (hashtagCount > 3) reasons.push('hashtag spam');
    if (hasNoisePattern) reasons.push('contains noise patterns');
    if (hasSignalPattern) reasons.push('contains signal indicators');
    
    const reason = reasons.length > 0 
      ? `Heuristic analysis: ${reasons.join(', ')}`
      : 'Heuristic analysis based on content patterns';
    
    return {
      score,
      isSignal: score >= (100 - this.settings.threshold),
      confidence: 'heuristic',
      reason
    };
  }

  async analyzeWithAI(data) {
    // This would be implemented in the background script
    // Send message to background script for API call
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        extLog.warn('AI analysis timed out, falling back to heuristics');
        resolve(this.analyzeWithHeuristics(data));
      }, 5000); // 5 second timeout
      
      chrome.runtime.sendMessage({
        action: 'analyzeTweet',
        text: data.text,
        apiKey: this.settings.apiKey,
        tweetData: data // Include full tweet data for training
      }, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          extLog.warn('Chrome runtime error', { error: chrome.runtime.lastError.message });
          resolve(this.analyzeWithHeuristics(data));
        } else if (response && response.score !== undefined) {
          resolve({
            score: response.score,
            isSignal: response.score >= (100 - this.settings.threshold),
            confidence: 'ai',
            reason: response.reason || 'AI analysis'
          });
        } else {
          // Fallback to heuristics if AI fails
          resolve(this.analyzeWithHeuristics(data));
        }
      });
    });
  }

  calculateCapsRatio(text) {
    const letters = text.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) return 0;
    
    const upperCount = (text.match(/[A-Z]/g) || []).length;
    return upperCount / letters.length;
  }

  calculateEmojiDensity(text) {
    // Simple emoji detection
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
    const emojiCount = (text.match(emojiRegex) || []).length;
    return text.length > 0 ? emojiCount / text.length : 0;
  }
}

// Export for use in content.js
window.TweetAnalyzer = TweetAnalyzer;