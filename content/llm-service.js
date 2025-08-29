// LLM Service for communicating with local Ollama server
class LLMService {
  constructor() {
    this.serverUrl = 'http://localhost:3001';
    this.connected = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.retryAttempts = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000; // Start with 1 second
    this.healthCheckInterval = null;
    this.lastHealthCheck = 0;
    this.hasLoggedDisconnection = false;
    this.lastRequestTime = 0;
    this.minRequestDelay = 200; // Minimum 200ms between requests
    
    // Initialize connection with retry logic
    this.initializeConnection();
  }

  async initializeConnection() {
    await this.checkConnection();
    
    // Set up periodic health checks if connected
    if (this.connected) {
      this.startHealthChecks();
    } else {
      // Retry connection with exponential backoff
      this.scheduleRetry();
    }
  }

  startHealthChecks() {
    // Clear any existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.checkConnection(true);
    }, 30000);
  }

  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  scheduleRetry() {
    if (this.retryAttempts >= this.maxRetries) {
      extLog.warn(`LLM Service: Max retries (${this.maxRetries}) reached. Giving up.`);
      this.stopHealthChecks();
      return;
    }
    
    const delay = this.retryDelay * Math.pow(2, this.retryAttempts);
    extLog.info(`LLM Service: Retrying connection in ${delay}ms (attempt ${this.retryAttempts + 1}/${this.maxRetries})`);
    
    setTimeout(() => {
      this.retryAttempts++;
      this.checkConnection();
    }, delay);
  }

  async checkConnection(isHealthCheck = false) {
    // Throttle health checks to prevent hammering the server
    const now = Date.now();
    if (isHealthCheck && now - this.lastHealthCheck < 5000) {
      return this.connected;
    }
    this.lastHealthCheck = now;
    
    try {
      const response = await fetch(`${this.serverUrl}/health`, {
        signal: AbortSignal.timeout(3000) // 3 second timeout
      });
      const data = await response.json();
      const wasConnected = this.connected;
      this.connected = data.status === 'ok' && data.ollama.connected;
      
      if (this.connected) {
        if (!wasConnected) {
          this.hasLoggedDisconnection = false; // Reset flag when reconnected
          this.retryAttempts = 0; // Reset retry counter on successful connection
          this.startHealthChecks(); // Start health checks
          
          // Notify user of successful connection
          this.notifyConnectionStatus(true, data.ollama.models);
        }
      } else {
        if (!this.hasLoggedDisconnection) {
          console.log('Ollama is not connected. Tweets will not be analyzed.');
          this.hasLoggedDisconnection = true;
        }
        if (wasConnected) {
          this.notifyConnectionStatus(false, null, 'Ollama disconnected');
        }
      }
    } catch (error) {
      const wasConnected = this.connected;
      this.connected = false;
      
      if (!this.hasLoggedDisconnection) {
        console.log('Ollama is not connected. Tweets will not be analyzed.');
        this.hasLoggedDisconnection = true;
      }
      
      if (wasConnected) {
        this.notifyConnectionStatus(false, null, error.message);
      }
      
      if (!isHealthCheck) {
        this.scheduleRetry();
      }
    }
    
    return this.connected;
  }

  notifyConnectionStatus(connected, models = null, error = null) {
    // Send message to background script to update badge or notify user
    chrome.runtime.sendMessage({
      action: 'llmConnectionStatus',
      connected,
      models: models ? models.map(m => m.name) : [],
      error
    }, () => {
      // Check for errors but don't block on them
      if (chrome.runtime.lastError) {
        extLog.warn('Failed to notify connection status', { error: chrome.runtime.lastError.message });
      }
    });
  }

  async analyzeTweet(tweetText, userPreferences = {}, tweetData = null) {
    if (!this.connected) {
      await this.checkConnection();
      if (!this.connected) {
        return null; // No analysis when not connected
      }
    }
    
    // Rate limiting: ensure minimum delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestDelay) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestDelay - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();


    // Implement retry logic for individual requests
    let lastError;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        if (attempt > 0 && window.SNR_DEBUG) {
          console.log(`[LLM Service] Retry attempt ${attempt + 1}/3`);
        }
        
        const requestBody = {
          text: tweetText,
          interests: userPreferences.interests || [],
          signalPatterns: userPreferences.signalPatterns || [],
          noisePatterns: userPreferences.noisePatterns || [],
          threshold: userPreferences.threshold || 30
        };
        
        // Include full tweet data if available for multi-agent analysis
        if (tweetData) {
          // Remove DOM element reference before sending (cannot be serialized)
          const { element, ...cleanTweetData } = tweetData;
          requestBody.tweetData = cleanTweetData;
          requestBody.userPreferences = userPreferences;
        }
        
        const startTime = performance.now();
        const response = await fetch(`${this.serverUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(15000) // 15 second timeout per request
        });

        if (!response.ok) {
          const errorText = await response.text();
          extLog.error('Server returned error', {
            status: response.status,
            error: errorText,
            tweetPreview: tweetText.substring(0, 100)
          });
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        const clientLatency = Math.round(performance.now() - startTime);
        
        
        // Add LLM-specific metadata
        return {
          score: result.score,
          isSignal: result.isSignal,
          category: result.category || (result.isSignal ? 'signal' : 'noise'),
          reason: result.reason,
          confidence: result.confidence || 'llm',
          model: result.model,
          latency: result.latency,
          agentScores: result.agentScores,
          agentCount: result.agentCount
        };
      } catch (error) {
        lastError = error;
        if (window.SNR_DEBUG) {
          console.warn(`[LLM Service] Attempt ${attempt + 1} failed:`, error.message);
        }
        
        if (attempt < 2) {
          // Wait before retry with exponential backoff
          const delay = 500 * Math.pow(2, attempt);
          if (window.SNR_DEBUG) {
            console.log(`[LLM Service] Waiting ${delay}ms before retry...`);
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    this.connected = false;
    this.checkConnection(); // Trigger reconnection attempt
    return null; // No analysis when connection fails
  }

  async analyzeBatch(tweets, userInterests = []) {
    if (!this.connected) {
      await this.checkConnection();
      if (!this.connected) {
        return null;
      }
    }

    try {
      const response = await fetch(`${this.serverUrl}/analyze-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tweets: tweets.map(t => ({ text: t.text, id: t.id })),
          interests: userInterests
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      return data.results;
    } catch (error) {
      extLog.error('Batch analysis error', { error: error.message, stack: error.stack });
      this.connected = false;
      return null;
    }
  }

  // WebSocket support for real-time analysis (optional)
  connectWebSocket() {
    if (typeof io === 'undefined') {
      extLog.warn('Socket.IO not loaded. Skipping WebSocket connection.');
      return;
    }

    this.socket = io(this.serverUrl);

    this.socket.on('connect', () => {
      extLog.info('WebSocket connected');
      this.connected = true;
    });

    this.socket.on('disconnect', () => {
      extLog.info('WebSocket disconnected');
      this.connected = false;
    });

    this.socket.on('analysis-result', (data) => {
      const { requestId, ...result } = data;
      const callback = this.pendingRequests.get(requestId);
      if (callback) {
        callback(result);
        this.pendingRequests.delete(requestId);
      }
    });

    this.socket.on('batch-result', (data) => {
      const { requestId, results } = data;
      const callback = this.pendingRequests.get(requestId);
      if (callback) {
        callback(results);
        this.pendingRequests.delete(requestId);
      }
    });

    this.socket.on('analysis-error', (data) => {
      const { requestId, error } = data;
      const callback = this.pendingRequests.get(requestId);
      if (callback) {
        callback(null);
        this.pendingRequests.delete(requestId);
      }
    });
  }

  async analyzeTweetRealtime(tweetText, userInterests = []) {
    if (!this.socket || !this.socket.connected) {
      return this.analyzeTweet(tweetText, userInterests);
    }

    return new Promise((resolve) => {
      const requestId = ++this.requestId;
      this.pendingRequests.set(requestId, resolve);

      this.socket.emit('analyze', {
        text: tweetText,
        interests: userInterests,
        requestId
      });

      // Timeout fallback
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          resolve(null);
        }
      }, 5000);
    });
  }

  // Clean up on page unload
  destroy() {
    this.stopHealthChecks();
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Export as global for use in content script
window.LLMService = LLMService;

// Clean up on page unload
window.addEventListener('unload', () => {
  if (window.llmServiceInstance) {
    window.llmServiceInstance.destroy();
  }
});