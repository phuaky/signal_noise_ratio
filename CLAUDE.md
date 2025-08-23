# CLAUDE.md - Developer Guide

This file provides comprehensive guidance for Claude Code (claude.ai/code) and developers working with the Signal/Noise Ratio Chrome extension - a **100% local, privacy-first** tweet analysis system.

## 🚀 Quick Start

```bash
# 1. Install and start Ollama
ollama serve
ollama pull qwen3:latest  # or llama3.2:3b

# 2. Start local server
cd server && npm install && npm start

# 3. Load extension in Chrome
chrome://extensions/ → Developer mode → Load unpacked → Select this folder

# 4. Test on X.com
Navigate to x.com → Look for green/red badges on tweets
```

## 🏗️ Architecture Overview

### System Design

This is a **local-only** Chrome extension that requires Ollama to function:

```
X.com (DOM)
    ↓
Content Scripts (Injected)
    ↓
Local Express Server (Port 3001)
    ↓
Ollama API (Port 11434)
    ↓
Local LLM (Qwen/Llama)
```

**Key Point**: Without Ollama running, the extension does NOT analyze tweets. There are no fallback methods.

## 📁 Core Components

### 1. Content Scripts (Injected into X.com)

#### `content.js` - Main Orchestrator
- MutationObserver for new tweet detection
- Manages analysis queue and batching
- Coordinates UI updates (badges, borders, dashboard)
- Handles settings synchronization
- Manages WebSocket connection status

#### `analyzer.js` - Tweet Analysis Engine
```javascript
// Actual implementation flow:
async analyzeTweet(tweetElement, options) {
  // 1. Extract tweet data
  const tweetData = this.extractTweetData(tweetElement);
  
  // 2. Quick pre-filter (95%+ confidence only)
  const quickResult = this.quickHeuristicFilter(tweetData);
  if (quickResult?.confidence >= 0.95) return quickResult;
  
  // 3. LLM analysis (REQUIRED - no fallback)
  if (!this.llmService) return null; // No analysis without LLM
  
  const result = await this.llmService.analyzeTweet(tweetData);
  return result || null; // null = no badge shown
}
```

#### `llm-service.js` - Ollama Connection Manager
- WebSocket connection to local server
- Automatic reconnection with exponential backoff
- Queue management for batch processing
- Connection health monitoring
- **NO fallback mechanism** - returns null if disconnected

### 2. Local Server (`server/`)

#### `index.js` - Express + WebSocket Server
- CORS configured for extension only
- REST endpoints: `/health`, `/analyze`, `/analyze-batch`
- WebSocket for real-time analysis
- No external API calls

#### `ollama-client.js` - Ollama Integration
```javascript
// Current configuration:
this.defaultModel = 'llama3.2:3b'; // Can be changed
// Available: qwen3:latest, qwen2.5:7b, llama3.2:3b, llama3.2:1b

// Analysis method (single-agent only):
async analyzeContent(text, userPreferences) {
  const prompt = this.buildContentPrompt(text);
  const response = await this.generateCompletion(prompt);
  return this.parseResponse(response);
}
```

**Note**: Multi-agent analysis code exists but is **commented out** (lines 72-114).

### 3. Background Service Worker

#### `background.js` - Settings & Messaging
- Chrome storage management
- Message routing between components
- Badge status updates (ON/OFF)
- **No cloud API handling** (despite legacy references)

## 🔍 Critical Implementation Details

### Analysis Flow (What Actually Happens)

1. **Tweet Appears** → MutationObserver detects
2. **Check LLM Connection** → If disconnected, skip analysis
3. **Queue Tweet** → Add to batch for efficiency
4. **Send to Server** → POST to localhost:3001
5. **Ollama Processing** → Server calls Ollama API
6. **Parse Response** → Extract score (0-100) and reasoning
7. **Apply UI** → Add badge, border, update dashboard
8. **Cache Result** → 1-hour cache to avoid re-analysis

### Scoring System

```javascript
// Categories based on score:
score >= 80: "high-signal" (Green)
score >= threshold: "signal" (Green)  
score >= 40: "medium" (Yellow)
score < 40: "noise" (Red)
```

### Quick Pre-Filter (Minimal Heuristics)

Only catches extremely obvious cases (95%+ confidence):
- Known tech leaders (PG, Sama, etc.)
- Extreme spam patterns (all caps + emojis)
- Empty or single-word tweets

This is NOT a fallback - just optimization to skip LLM for obvious cases.

## ⚠️ Important Limitations

### No Fallback Analysis
- If Ollama is disconnected, tweets are NOT analyzed
- No heuristic-only mode despite UI references
- No cloud API support despite code references

### Dependency on Ollama
- Extension is 100% dependent on local Ollama
- Must have at least one model pulled
- Requires ~2-8GB RAM depending on model

### Performance Considerations
- First analysis after startup is slow (model loading)
- Batch processing may cause slight delays
- Large models (7B) significantly slower than small (1B)

## 🛠️ Development Workflow

### Setup Development Environment

```bash
# 1. Clone repo
git clone <repo>
cd signal_noise_ratio

# 2. Install Ollama models
ollama pull qwen3:latest
ollama pull llama3.2:3b

# 3. Start server in dev mode
cd server
npm install
npm run dev  # Auto-restarts on changes

# 4. Load extension (unpacked)
# Chrome → chrome://extensions/ → Load unpacked
```

### Debugging

#### Enable Debug Mode
```javascript
// Method 1: Keyboard shortcut on X.com
Ctrl+Shift+D

// Method 2: Set in storage
chrome.storage.local.set({ debugMode: true });

// Method 3: Local storage
localStorage.setItem('snr_debug', 'true');
```

#### View Logs
```bash
# Server logs (structured JSON)
tail -f server/server.log | jq '.'

# Filter for errors
tail -f server/server.log | jq 'select(.level == "error")'

# Connection status
curl http://localhost:3001/health | jq '.'
```

#### Chrome DevTools
- Content scripts: Inspect on X.com page
- Service worker: chrome://extensions/ → Service Worker → Inspect
- Check badge text for connection status

## 📊 Testing

### Integration Test
```bash
# Start everything
ollama serve
cd server && npm start

# In another terminal
cd server
node test-tweet-analysis.js
```

### Manual Testing Checklist
- [ ] Ollama running (`ollama list`)
- [ ] Server running (`curl localhost:3001/health`)
- [ ] Extension loaded (chrome://extensions/)
- [ ] Navigate to X.com
- [ ] Badge shows "ON" (connected)
- [ ] Tweets get badges within 2-3 seconds
- [ ] Dashboard appears (bottom-right)
- [ ] Debug panel works (Ctrl+Shift+D)

## 🐛 Common Issues & Solutions

### No Badges Appearing

```bash
# 1. Check Ollama
ollama list  # Should show models
curl http://localhost:11434/api/tags  # Should return JSON

# 2. Check server
lsof -i :3001  # Should show node process
curl http://localhost:3001/health

# 3. Check extension
# Badge should show "ON" not "OFF"
# Open DevTools on X.com, check for errors
```

### Slow Analysis

```javascript
// Change model in server/ollama-client.js
this.defaultModel = 'llama3.2:1b'; // Fastest option
```

### Memory Issues

```javascript
// Clear cache periodically
const cache = new Map();
// Limit cache size in analyzer.js
if (cache.size > 100) {
  cache.clear();
}
```

## 📝 Configuration

### Available Models (Tested)

| Model | Speed | Quality | Use Case |
|-------|-------|---------|----------|
| llama3.2:1b | Fastest | Good | Quick browsing |
| llama3.2:3b | Fast | Better | Default choice |
| qwen3:latest | Medium | Best | Quality focus |
| qwen2.5:7b | Slow | Excellent | Best results |

### Server Configuration

```env
# server/.env
PORT=3001
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:latest  # Override default
OLLAMA_DEBUG=true  # Verbose logging
```

### Extension Settings

Settings stored in Chrome storage:
- `threshold`: Signal/noise cutoff (default: 30)
- `useLocalLLM`: Always true (required)
- `batchSize`: Tweets per batch (default: 5)
- `debugMode`: Show detailed logs
- `showIndicators`: Visual badges on/off

## 🚫 What Doesn't Work

Despite references in code/UI, these features are **NOT functional**:

1. **Cloud APIs** - No Anthropic/OpenAI integration
2. **Heuristic Mode** - Not a standalone analysis method
3. **Multi-Agent Analysis** - Code exists but disabled
4. **Offline Analysis** - Requires Ollama connection
5. **API Key Settings** - UI exists but non-functional

## 🔮 Future Improvements

To make the extension more robust:

1. **Implement True Heuristics** - Pattern-based fallback
2. **Enable Multi-Agent** - Uncomment and fix the code
3. **Add Cloud APIs** - Implement the referenced features
4. **Offline Cache** - Store recent analyses for offline
5. **Remove Misleading UI** - Clean up non-functional options

## 📚 Code Patterns

### Message Passing
```javascript
// Content → Background (not used for API)
chrome.runtime.sendMessage({ 
  action: 'updateBadge',
  status: 'connected' 
});
```

### Storage Pattern
```javascript
// Settings with defaults
const settings = await chrome.storage.local.get({
  threshold: 30,
  useLocalLLM: true,  // Always true
  debugMode: false
});
```

### Connection Management
```javascript
// Auto-reconnect WebSocket
class LLMService {
  connect() {
    this.ws = new WebSocket('ws://localhost:3001');
    this.ws.onclose = () => {
      setTimeout(() => this.connect(), 
        Math.min(1000 * 2 ** this.retryCount, 30000));
    };
  }
}
```

## ✅ What Works Well

- **Privacy**: 100% local, no data leakage
- **Visual Feedback**: Clear badges and borders
- **Real-time Updates**: Smooth scrolling analysis
- **Debug Tools**: Comprehensive logging
- **Training Mode**: Data collection for improvement
- **Connection Management**: Robust retry logic
- **Performance**: Optimized batching and caching

---

**Critical Note for Development**: This extension is entirely dependent on local Ollama. Any features suggesting otherwise (heuristics, cloud APIs) are legacy code or planned features that don't actually work. Focus development on improving the local LLM integration rather than implementing the non-functional features referenced in the UI.