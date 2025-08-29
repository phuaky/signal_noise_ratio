// Signal detection algorithm
class TweetAnalyzer {
  constructor() {
    this.settings = {
      threshold: 30,
      useAI: false,
      apiKey: '',
      useLocalLLM: false
    };
    
    // Load settings
    this.loadSettings();
    
    // Initialize LLM service if available
    this.llmService = window.LLMService ? new window.LLMService() : null;
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
    
    // Skip tweets without text
    if (!tweetData.text || tweetData.text.trim().length === 0) {
      return null;
    }
    
    // Use LLM for analysis (local or cloud)
    if (this.settings.useLocalLLM && this.llmService) {
      // Pass full tweet data for analysis
      const llmResult = await this.llmService.analyzeTweet(tweetData.text, this.userPreferences, tweetData);
      if (llmResult) {
        return llmResult;
      } else {
        // LLM not available - return null
        return null;
      }
    }
    
    // TODO: Add cloud API support here when useAI is true
    if (this.settings.useAI && this.settings.apiKey) {
      // Cloud API implementation would go here
      console.log('Cloud API analysis not yet implemented');
      return null;
    }
    
    // No analysis method configured
    return null;
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
    const links = Array.from(linkElements).map(link => {
      try {
        return {
          url: link.href,
          text: link.innerText,
          domain: new URL(link.href).hostname.replace('www.', '')
        };
      } catch (e) {
        // Skip malformed URLs
        extLog.debug('Skipping malformed URL', { href: link.href, error: e.message });
        return null;
      }
    }).filter(Boolean); // Remove null entries
    
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

}

// Export for use in content.js
window.TweetAnalyzer = TweetAnalyzer;