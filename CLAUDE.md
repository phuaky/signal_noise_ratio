# CLAUDE.md - Development Guide

This file provides comprehensive guidance for Claude Code (claude.ai/code) and developers working with the Signal/Noise Ratio Chrome extension.

## 🚀 Quick Start

```bash
# 1. Load extension in Chrome
chrome://extensions/ → Developer mode → Load unpacked → Select this folder

# 2. Start local server (for AI analysis)
cd server && npm install && npm start

# 3. Test on X.com
Navigate to x.com → Look for green/red badges on tweets

# 4. Run tests
node server/test-tweet-analysis.js
```

## 🏗️ Project Architecture

### Core Components

#### 1. **Content Scripts** (Injected into X.com)
- **content.js**: Main orchestrator
  - MutationObserver for new tweets
  - Coordinates analysis pipeline
  - Manages UI updates
  - Handles settings sync

- **analyzer.js**: TweetAnalyzer class
  - Weighted scoring algorithm
  - Tweet metadata extraction
  - Heuristic analysis logic
  - Score calculation (0-100)

- **llm-service.js**: Local LLM integration
  - WebSocket connection to server
  - Retry logic with exponential backoff
  - Fallback to heuristics
  - Connection health monitoring

#### 2. **Background Service Worker**
- **background.js**: API and settings manager
  - Chrome storage management
  - Cloud AI API calls (Claude/OpenAI)
  - Message routing between components
  - Badge icon updates

#### 3. **Local Server** (Node.js/Express)
- **index.js**: Express server
  - REST endpoints for analysis
  - WebSocket for real-time updates
  - CORS handling for extension
  - Request batching

- **ollama-client.js**: Ollama integration
  - Model management
  - Prompt engineering
  - Response parsing
  - Connection pooling

## 📊 Weighted Scoring Algorithm

The heuristic analyzer uses a sophisticated weighted scoring system:

```javascript
// Base score starts at 50 (neutral)
let score = 50;

// Positive signals (increase score)
if (hasExternalLinks) score += 20;  // Informative content
if (isThread) score += 15;          // In-depth discussion
if (isVerified) score += 10;        // Credibility
if (hasMedia) score += 10;          // Rich content
if (textLength > 280) score += 10;  // Detailed post
if (engagementRatio > 0.1) score += 15; // Quality engagement

// Negative signals (decrease score)
if (capsRatio > 0.3) score -= 20;   // SHOUTING
if (emojiCount > 5) score -= 15;    // Spam indicator
if (hasClickbait) score -= 25;      // "You won't BELIEVE..."
if (textLength < 50) score -= 15;   // Low effort
if (isReplyChain) score -= 10;      // Noise thread

// Clamp between 0-100
score = Math.max(0, Math.min(100, score));
```

## 🛠️ Development Workflow

### Loading & Testing

1. **Initial Setup**
   ```bash
   # Clone and prepare
   git clone <repo>
   cd signal_noise_ratio
   
   # Install server dependencies
   cd server && npm install
   ```

2. **Chrome Extension**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select project root directory

3. **Reload After Changes**
   - Content scripts: Refresh X.com page
   - Background script: Click reload in chrome://extensions/
   - Server changes: Restart with `npm start`

### Debugging

#### Content Scripts
```javascript
// Enable debug mode (Ctrl+Shift+D on X.com)
localStorage.setItem('snr_debug', 'true');

// Or programmatically
chrome.storage.local.set({ debugMode: true });
```

#### Background Script
- chrome://extensions/ → Details → Service Worker → Inspect

#### Server Logs
```bash
# Structured JSON logs
tail -f server/server.log | jq '.'

# Connection status
curl http://localhost:3001/health | jq '.'
```

## 🧪 Testing

### Unit Tests
```bash
# Test server API
cd server
node test-tweet-analysis.js

# Test Ollama integration
node test-ollama.js
```

### Integration Tests
```javascript
// In Chrome Console on X.com
// Load and run test suite
const script = await fetch(chrome.runtime.getURL('tests/test-extension.js'));
eval(await script.text());
```

### Performance Testing
```bash
# Benchmark different models
cd server
node benchmark.js

# Monitor memory
# Chrome Task Manager (Shift+Esc)
# Look for "Signal/Noise Ratio" entry
```

## 📝 Key Implementation Details

### Message Passing
```javascript
// Content → Background
const response = await chrome.runtime.sendMessage({
  action: 'analyzeWithAI',
  data: { text, author, metrics }
});

// Background → Content (broadcast)
chrome.tabs.query({ url: ['*://x.com/*', '*://twitter.com/*'] }, (tabs) => {
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated' });
  });
});
```

### Chrome Storage Pattern
```javascript
// Settings with defaults
const getSettings = async () => {
  const defaults = {
    threshold: 30,
    useLocalLLM: false,
    debugMode: false
  };
  const stored = await chrome.storage.local.get(Object.keys(defaults));
  return { ...defaults, ...stored };
};

// Atomic updates
await chrome.storage.local.set({ 
  [`stat_${Date.now()}`]: value 
});
```

### DOM Observation
```javascript
// Efficient tweet detection
const observer = new MutationObserver((mutations) => {
  const tweets = new Set();
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1) {
        const tweet = node.querySelector?.('[data-testid="tweet"]');
        if (tweet) tweets.add(tweet);
      }
    });
  });
  if (tweets.size > 0) analyzeTweets([...tweets]);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});
```

### WebSocket Handling
```javascript
// Auto-reconnect pattern
class LLMService {
  connect() {
    this.ws = new WebSocket('ws://localhost:3001');
    
    this.ws.onclose = () => {
      this.retryCount++;
      const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
      setTimeout(() => this.connect(), delay);
    };
    
    this.ws.onopen = () => {
      this.retryCount = 0;
      this.processQueue();
    };
  }
}
```

## 🐛 Common Issues & Solutions

### Extension Not Loading
```bash
# Check manifest syntax
python -m json.tool manifest.json

# Check permissions
# Ensure host_permissions includes x.com and twitter.com
```

### Badges Not Appearing
```javascript
// Check selectors are current
document.querySelector('[data-testid="tweet"]'); // Should find tweets

// Verify injection
console.log(window.TweetAnalyzer); // Should be defined
```

### Server Connection Failed
```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Check server is running
lsof -i :3001  # Should show node process

# Check CORS headers
curl -I http://localhost:3001/health
```

### Memory Leaks
```javascript
// Use WeakMap for DOM references
const analyzedTweets = new WeakMap();

// Clean up observers
observer.disconnect();

// Clear old storage data
const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
const storage = await chrome.storage.local.get();
const toRemove = Object.keys(storage)
  .filter(key => key.startsWith('stat_') && parseInt(key.split('_')[1]) < oneWeekAgo);
await chrome.storage.local.remove(toRemove);
```

## 🔍 Code Quality Checklist

Before committing:

- [ ] Run test suite: `node server/test-tweet-analysis.js`
- [ ] Check extension loads without errors
- [ ] Verify badges appear on tweets
- [ ] Test with Ollama connected and disconnected
- [ ] Monitor memory usage (should stay under 50MB)
- [ ] Check for console errors on X.com
- [ ] Test settings persistence
- [ ] Verify real-time updates work
- [ ] Test on both x.com and twitter.com

## 📚 API Reference

### Server Endpoints

```bash
# Health check
GET /health
Response: { status: "ok", ollama: { connected: boolean, models: [] } }

# Single tweet analysis
POST /analyze
Body: { text: string, author: string, metrics: object }
Response: { score: number, isSignal: boolean, confidence: number }

# Batch analysis
POST /analyze-batch
Body: { tweets: array }
Response: { results: array }
```

### Chrome Runtime API Usage

```javascript
// Get extension URL
chrome.runtime.getURL('path/to/file');

// Get manifest
chrome.runtime.getManifest();

// Message passing
chrome.runtime.sendMessage();
chrome.runtime.onMessage.addListener();

// Storage
chrome.storage.local.get/set/remove/clear();
chrome.storage.onChanged.addListener();
```

## 🚀 Performance Optimization

### Batch Processing
```javascript
// Process tweets in batches
const batchSize = 10;
const batches = [];
for (let i = 0; i < tweets.length; i += batchSize) {
  batches.push(tweets.slice(i, i + batchSize));
}

for (const batch of batches) {
  await Promise.all(batch.map(tweet => analyze(tweet)));
  await new Promise(r => setTimeout(r, 100)); // Prevent blocking
}
```

### Debouncing
```javascript
// Debounce scroll events
let scrollTimer;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    analyzeVisibleTweets();
  }, 200);
});
```

### Caching
```javascript
// Cache analysis results
const cache = new Map();
const getCacheKey = (tweet) => `${tweet.author}_${tweet.text.substring(0, 50)}`;

const analyze = async (tweet) => {
  const key = getCacheKey(tweet);
  if (cache.has(key)) return cache.get(key);
  
  const result = await performAnalysis(tweet);
  cache.set(key, result);
  
  // Limit cache size
  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
  
  return result;
};
```

## 📋 Manifest V3 Constraints

- **No remote code**: All JavaScript must be bundled
- **Service workers**: No persistent background pages
- **Content Security Policy**: Strict by default
- **Host permissions**: Must be explicitly declared

## 🎯 Future Enhancements

Potential improvements to consider:

1. **User Training**: Allow users to mark tweets as signal/noise to improve personalization
2. **Export Analytics**: Generate reports on feed quality over time
3. **Cross-Platform**: Support for other social media platforms
4. **Mobile Sync**: Sync settings across devices
5. **Advanced Filtering**: Regex patterns, author lists, topic modeling
6. **Performance**: Web Workers for heavy computation
7. **Accessibility**: Screen reader support, keyboard navigation

---

**Note**: This guide is optimized for Claude Code. When making changes, preserve the existing patterns and maintain backward compatibility.