// Simple logger without chalk for cleaner output

class Logger {
  constructor() {
    this.requestCounter = 0;
  }

  // Format timestamp
  timestamp() {
    return new Date().toISOString();
  }

  // Main logging method for tweet analysis - clean, easy to read format
  logTweetAnalysis(data) {
    const {
      requestId,
      tweet,
      score,
      isSignal,
      reason,
      latency,
      model
    } = data;

    // Clean format without redundant LLM Response line since it's already shown
    console.log(`\n[${this.timestamp()}] LLM Response ${requestId}`);
    console.log(`Score: ${score}`);
    console.log(`Is Signal: ${isSignal}`);
    console.log(`Reason: ${reason}`);
    console.log(`Latency: ${latency}ms`);
    console.log(`Model: ${model}`);
  }

  // Log analysis request with prompt
  logAnalysisWithPrompt(data) {
    const {
      requestId,
      tweet,
      userPreferences,
      prompt,
      rawResponse,
      parsedResult,
      score,
      isSignal,
      reason,
      latency,
      model
    } = data;

    console.log(`\n[${this.timestamp()}] LLM Analysis Request ${requestId}`);
    console.log(`Tweet: "${tweet}"`);
    console.log(`User Preferences: {`);
    console.log(`  interests: ${userPreferences.interests?.join(', ') || 'none'},`);
    console.log(`  signalPatterns: ${userPreferences.signalPatterns?.join(', ') || 'none'},`);
    console.log(`  noisePatterns: ${userPreferences.noisePatterns?.join(', ') || 'none'},`);
    console.log(`  threshold: ${userPreferences.threshold || 30}`);
    console.log(`}`);
    
    if (process.env.SHOW_PROMPTS) {
      console.log(`\n=== OLLAMA PROMPT ===`);
      console.log(prompt);
      console.log(`=== END PROMPT ===`);
    }
    
    if (rawResponse) {
      console.log(`\n=== OLLAMA RAW RESPONSE ===`);
      console.log(rawResponse);
      console.log(`=== END RESPONSE ===`);
      
      console.log(`\n=== PARSED RESULT ===`);
      console.log(JSON.stringify(parsedResult, null, 2));
      console.log(`=== END RESULT ===`);
    }
    
    console.log(`\n[${this.timestamp()}] LLM Response ${requestId}`);
    console.log(`Score: ${score}`);
    console.log(`Is Signal: ${isSignal}`);
    console.log(`Reason: ${reason}`);
    console.log(`Latency: ${latency}ms`);
    console.log(`Model: ${model}`);
  }

  // Error logging
  logError(context, error, requestId) {
    console.error(`\n[${this.timestamp()}] ERROR ${requestId || 'N/A'}`);
    console.error(`Context: ${context}`);
    console.error(`Error: ${error.message}`);
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
  }

  // Connection status logging
  logConnection(status, details = '') {
    const statusText = status === 'connected' ? 'CONNECTED' : 'DISCONNECTED';
    console.log(`[${this.timestamp()}] Ollama Status: ${statusText}${details ? ` (${details})` : ''}`);
  }

  // Simple info logging
  info(message) {
    console.log(`[${this.timestamp()}] ${message}`);
  }

  // Debug logging (only in debug mode)
  debug(message, data) {
    if (process.env.DEBUG) {
      console.log(`[${this.timestamp()}] DEBUG: ${message}`);
      if (data) {
        console.log(JSON.stringify(data, null, 2));
      }
    }
  }

  // Performance summary
  logPerformanceSummary(stats) {
    console.log('\n=== Performance Summary ===');
    console.log(`Total Requests: ${stats.totalRequests}`);
    console.log(`Average Latency: ${stats.avgLatency}ms`);
    console.log(`Success Rate: ${stats.successRate}%`);
    console.log(`Cache Hit Rate: ${stats.cacheHitRate}%`);
    console.log('===========================\n');
  }
}

export default new Logger();