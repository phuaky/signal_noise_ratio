# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Loading and Testing the Extension

Since this is a Chrome extension without a build process, development is straightforward:

1. **Load the extension in Chrome**:
   ```bash
   # Open Chrome and navigate to:
   chrome://extensions/
   # Enable "Developer mode" (top right)
   # Click "Load unpacked" and select this directory
   ```

2. **Reload after changes**:
   - Click the refresh icon on the extension card in chrome://extensions/
   - Or use Cmd+R (Mac) / Ctrl+R (Windows) on the extensions page

3. **Debug the extension**:
   - **Content scripts**: Right-click on X.com → Inspect → Console tab
   - **Background script**: Click "Service Worker" link in chrome://extensions/
   - **Popup**: Right-click extension icon → Inspect popup
   - **Options page**: Right-click in options page → Inspect

4. **View console logs**:
   - Content script logs appear in the web page console
   - Background script logs appear in the service worker console
   - Popup logs appear in the popup inspector console

### Testing Ollama Integration

1. **Start the local server**:
   ```bash
   cd server
   npm install  # First time only
   npm start
   ```

2. **Run the comprehensive test suite**:
   ```bash
   cd server
   node test-suite.js
   ```
   This tests all API endpoints, error scenarios, WebSocket connections, and performance.

3. **Monitor Ollama connection**:
   - Open `http://localhost:3001/monitor.html` in your browser
   - Real-time connection status, performance metrics, and testing interface

4. **Benchmark different models**:
   ```bash
   cd server
   node benchmark.js
   ```
   Compares performance across different Ollama models.

5. **Quick health check**:
   ```bash
   curl http://localhost:3001/health
   ```

## Architecture Overview

This is a Chrome Extension (Manifest V3) that analyzes Twitter/X feed content quality. The architecture consists of three main layers:

### 1. Content Scripts (Injected into X.com)
- **content/analyzer.js**: Core `TweetAnalyzer` class that scores tweets using heuristics or AI
- **content/content.js**: Main script that observes DOM, manages UI elements, and coordinates analysis
- **content/styles.css**: Injected styles for visual indicators and dashboard

### 2. Background Service Worker
- **background/background.js**: Handles API calls to Claude/OpenAI, manages settings, processes AI requests from content scripts

### 3. Extension UI
- **popup/**: Quick access popup with stats and controls
- **options/**: Full settings page for configuration

### Data Flow
1. Content script detects new tweets via MutationObserver
2. TweetAnalyzer scores each tweet (heuristic or requests AI via background)
3. Visual indicators applied based on score
4. Statistics aggregated and stored in Chrome storage
5. Popup/dashboard read stats from storage for display

## Key Patterns and Constraints

### Chrome Storage API
All settings and stats use `chrome.storage.local`:
```javascript
// Read
const settings = await chrome.storage.local.get(['key1', 'key2']);

// Write
await chrome.storage.local.set({ key: value });
```

### Message Passing
Communication between content scripts and background:
```javascript
// From content script
const response = await chrome.runtime.sendMessage({ 
  action: 'analyzeWithAI', 
  data: tweetData 
});

// In background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyzeWithAI') {
    // Process and return true for async response
    return true;
  }
});
```

### Manifest V3 Constraints
- No remote code execution
- Service workers instead of persistent background pages
- All scripts must be local files
- Host permissions must be explicit

## Core Components

### TweetAnalyzer Class (content/analyzer.js)
- Extracts tweet metadata (text, author, metrics, media)
- Implements weighted scoring algorithm
- Supports both heuristic and AI analysis modes
- Key method: `analyzeTweet(tweetElement, options)`

### Content Script Patterns (content/content.js)
- Uses MutationObserver to detect new tweets dynamically
- Maintains WeakMap for analyzed tweet tracking
- Injects visual elements (badges, borders, dashboard)
- Handles settings sync and real-time updates

### Background Script API Handling (background/background.js)
- Validates API keys and manages requests
- Implements retry logic for API failures
- Falls back to heuristic analysis on errors
- Supports both Anthropic Claude and OpenAI APIs

### Settings Management
- Default values set in background script on install
- Settings changes trigger re-analysis of visible tweets
- API keys stored securely in Chrome local storage
- Real-time settings sync across all tabs
- Local LLM connection status shown in extension badge

### Local LLM Integration (content/llm-service.js)
- Automatic connection with retry logic (exponential backoff)
- Health checks every 30 seconds when connected
- Graceful fallback to heuristics on connection failure
- Per-request retry logic with timeouts
- Connection status notifications via badge

## Development Guidelines

### Adding New Features
1. Check manifest.json permissions for new APIs
2. Update content script for DOM-related features
3. Add message handlers in background for API features
4. Update options UI for new settings

### Testing Considerations
- Test on both twitter.com and x.com domains
- Verify behavior with infinite scroll
- Test API fallback scenarios
- Check memory usage with many analyzed tweets

### Common Issues
- Tweet structure changes: Update selectors in analyzer.js
- API rate limits: Implement caching/batching in background.js
- Performance: Use requestIdleCallback for non-critical analysis
- Memory leaks: Ensure WeakMap usage for DOM references
- Ollama connection issues: Check server logs and monitor dashboard
- Model performance: Run benchmark.js to compare models

### Testing Checklist
Before committing changes:
1. Run the test suite: `node server/test-suite.js`
2. Check the monitor dashboard for connection stability
3. Test with both Ollama connected and disconnected
4. Verify fallback to heuristics works correctly
5. Check memory usage in Chrome Task Manager
```

## Working Style

- Always use and summon multiple subagents to work on tasks.