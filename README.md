# Signal/Noise Ratio for X (Twitter)

A Chrome extension that intelligently filters your X.com feed by analyzing tweet quality in real-time. Using a sophisticated weighted scoring algorithm and optional AI analysis, it helps you focus on high-quality content while reducing exposure to low-value noise.

## 🎯 Key Features

### Visual Tweet Classification
- **🟢 Green badges** - High-quality "Signal" content (informative, educational, substantive)
- **🔴 Red badges** - Low-quality "Noise" content (spam, clickbait, rage bait)
- **Colored borders** - Quick visual scanning with left border indicators
- **Score percentages** - See exact quality scores (0-100%)

### Real-time Dashboard
A floating dashboard in the bottom-right corner shows:
- Live signal/noise ratio percentage
- Animated waveform visualization of feed quality
- Total tweets analyzed counter
- Quick refresh button for re-analysis

### Three Analysis Modes

#### 1. **Heuristic Mode** (Default - Instant & Free)
Uses a weighted scoring algorithm analyzing:
- Text quality and length
- Engagement metrics ratios
- Media presence
- Thread indicators
- Caps lock usage
- Emoji density
- Clickbait patterns

#### 2. **Local LLM Mode** (Private & Free)
Powered by Ollama running on your machine:
- 100% private - data never leaves your computer
- Intelligent context-aware analysis
- ~500ms response time after warmup
- Supports multiple models (Llama, Qwen, etc.)

#### 3. **Cloud AI Mode** (Most Accurate)
Optional integration with Claude or OpenAI:
- Most sophisticated analysis
- Requires API key
- ~$0.01 per 1000 tweets

## 📦 Installation

### Step 1: Install the Extension

```bash
# Clone the repository
git clone https://github.com/yourusername/signal_noise_ratio.git
cd signal_noise_ratio

# Or download the ZIP from GitHub
```

### Step 2: Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `signal_noise_ratio` folder
5. Pin the extension icon to your toolbar

### Step 3: Test on X.com

1. Navigate to [x.com](https://x.com) or [twitter.com](https://twitter.com)
2. You should immediately see badges appearing on tweets
3. Look for the dashboard in the bottom-right corner

## 🤖 Local LLM Setup (Recommended)

For the best balance of privacy, speed, and intelligence:

### Install Ollama

```bash
# macOS
brew install ollama
ollama serve  # Start Ollama service

# Linux
curl -fsSL https://ollama.com/install.sh | sh
systemctl start ollama  # Start as service

# Windows
# Download from https://ollama.com
```

### Download a Model

```bash
# Fastest option (1.3GB)
ollama pull llama3.2:1b

# Balanced option (2GB)
ollama pull llama3.2:3b

# Most capable (5GB)
ollama pull qwen2.5:7b
```

### Start the Extension Server

```bash
cd signal_noise_ratio/server
npm install  # First time only
npm start    # Starts on port 3001
```

The server will automatically:
- Connect to Ollama
- Handle retries with exponential backoff
- Fall back to heuristics if Ollama is unavailable
- Show connection status in logs

### Enable in Extension

1. Click the extension icon in Chrome toolbar
2. Click **Settings**
3. Select **Local LLM (Ollama)**
4. The badge icon will show connection status

## 🎮 Usage Guide

### Basic Operation

The extension works automatically once installed:
- Analyzes tweets as they load
- Updates in real-time as you scroll
- Re-analyzes when settings change

### Keyboard Shortcuts

- **Ctrl+Shift+D** - Toggle debug mode (see detailed logs)
- **Ctrl+Shift+R** - Force re-analyze all visible tweets

### Settings & Customization

Access via extension popup → Settings:

#### Display Options
- **Show Indicators** - Toggle badge visibility
- **Auto-hide Noise** - Blur/collapse low-quality tweets
- **Show Dashboard** - Toggle floating statistics panel
- **Debug Mode** - Show detailed analysis logs

#### Analysis Settings
- **Threshold** - Adjust signal/noise cutoff (default: 30%)
  - Lower = more permissive
  - Higher = stricter filtering
- **Analysis Mode** - Choose between Heuristic/Local/Cloud
- **Batch Size** - Tweets to analyze at once (affects performance)

#### Personalization
- **Interests** - Add keywords to boost relevant content
- **Signal Patterns** - Custom patterns for high-quality content
- **Noise Patterns** - Custom patterns for low-quality content

## 🏗️ Architecture

### Extension Structure
```
signal_noise_ratio/
├── manifest.json           # Chrome extension configuration
├── content/               # Core functionality (injected into X.com)
│   ├── content.js        # Main orchestrator
│   ├── analyzer.js       # TweetAnalyzer class with scoring logic
│   ├── llm-service.js    # Local LLM communication
│   ├── styles.css        # Visual indicators styling
│   └── waveform.js       # Dashboard visualization
├── background/            # Service worker
│   └── background.js     # API handling, settings management
├── popup/                 # Extension popup UI
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/              # Full settings page
│   ├── options.html
│   ├── options.js
│   └── options.css
├── server/               # Local LLM server
│   ├── index.js         # Express server with WebSocket
│   ├── ollama-client.js # Ollama API integration
│   └── logger.js        # Structured logging
└── tests/               # Testing utilities
    ├── test-extension.js
    └── diagnostic.js
```

### Data Flow

1. **Tweet Detection**: MutationObserver watches for new tweets
2. **Analysis Pipeline**:
   - Extract tweet metadata (text, author, metrics)
   - Apply weighted scoring algorithm
   - Optional AI enhancement via local/cloud
3. **Visual Update**: Inject badges and apply styling
4. **Statistics**: Aggregate and store in Chrome storage
5. **Dashboard Update**: Real-time chart and metrics

### Weighted Scoring Algorithm

The heuristic analyzer uses multiple weighted factors:

```javascript
Base Score = 50 (neutral)

Positive Factors (+):
- Has links: +20 points
- Is thread: +15 points  
- From verified: +10 points
- Has media: +10 points
- Good engagement ratio: +15 points
- Long text (>280 chars): +10 points

Negative Factors (-):
- High caps ratio: -20 points
- Excessive emojis: -15 points
- Clickbait keywords: -25 points
- Very short text: -15 points
- Poor engagement: -10 points

Final Score = Clamp(0, 100)
```

## 🧪 Testing

### Quick Test in Console

```javascript
// Paste in Chrome DevTools Console on X.com
// Check if extension is active
console.log('Badges:', document.querySelectorAll('.sn-badge').length);
console.log('Dashboard:', !!document.querySelector('.sn-dashboard'));

// Force re-analysis
window.postMessage({ type: 'SNR_ANALYZE_VISIBLE' }, '*');
```

### Run Test Suite

```bash
# Test server endpoints
cd server
node test-tweet-analysis.js

# Test extension in browser
# 1. Open X.com
# 2. Open DevTools Console
# 3. Paste contents of tests/test-extension.js
```

### Monitor Performance

```bash
# Server monitoring
curl http://localhost:3001/health | jq '.'

# Watch server logs
tail -f server/server.log
```

## 🔧 Troubleshooting

### Extension Not Working?

1. **Check Installation**
   - Verify extension is enabled in chrome://extensions/
   - Try reloading the extension
   - Refresh X.com page

2. **Check Console**
   - Open DevTools (F12)
   - Look for errors in Console tab
   - Enable debug mode (Ctrl+Shift+D)

3. **Run Diagnostic**
   ```javascript
   // Paste in console
   copy(await fetch(chrome.runtime.getURL('tests/diagnostic.js')).then(r => r.text()))
   ```

### Local LLM Issues?

1. **Check Ollama**
   ```bash
   ollama list  # Should show your models
   curl http://localhost:11434/api/tags  # Should return JSON
   ```

2. **Check Server**
   ```bash
   curl http://localhost:3001/health
   # Should show: {"status":"ok","ollama":{"connected":true}}
   ```

3. **Check Logs**
   ```bash
   tail -f server/server.log
   # Look for connection errors
   ```

### Performance Issues?

- Reduce batch size in settings
- Switch to heuristic mode
- Disable debug mode
- Clear Chrome storage if over 5MB

## 🔐 Privacy & Security

- **No tracking**: Zero analytics or telemetry
- **Local storage only**: All data stays in Chrome
- **No external requests**: Unless you enable cloud AI
- **Open source**: Fully auditable code
- **Secure API handling**: Keys never logged or transmitted

## 🚀 Advanced Features

### WebSocket Real-time Updates
The server supports WebSocket connections for live analysis:
```javascript
const ws = new WebSocket('ws://localhost:3001');
ws.send(JSON.stringify({ type: 'analyze', data: tweetData }));
```

### Batch Analysis
Analyze multiple tweets efficiently:
```bash
curl -X POST http://localhost:3001/analyze-batch \
  -H "Content-Type: application/json" \
  -d '{"tweets": [...]}'
```

### Custom Models
Configure different Ollama models in server/.env:
```env
OLLAMA_MODEL=llama3.2:3b
OLLAMA_HOST=http://localhost:11434
```

## 📝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Follow the existing code style
4. Add tests for new features
5. Submit a pull request

### Development Tips

- Use `npm run dev` for auto-restart server
- Enable debug mode for detailed logs
- Test on both x.com and twitter.com
- Check memory usage in Chrome Task Manager

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with Chrome Extension Manifest V3
- Powered by Ollama for local AI
- Inspired by the need for healthier social media consumption
- Thanks to all contributors and testers

---

**Remember**: This tool helps you be mindful of content quality. The goal isn't to eliminate all "noise" but to be aware of what you're consuming and make intentional choices about your attention.