# Signal/Noise Ratio for X (Twitter)

A privacy-first Chrome extension that analyzes your X.com feed quality using **100% local AI**. Powered by Ollama running on your machine, it intelligently classifies tweets as high-quality "Signal" or low-value "Noise" without any data leaving your computer.

## 🎯 Core Features

### Local AI-Powered Analysis
- **100% Private**: All analysis happens on your machine using Ollama
- **No Cloud Services**: Zero external API calls, complete data privacy
- **Smart Classification**: AI understands context, nuance, and quality
- **Multiple Models**: Supports Qwen (3B/7B) and Llama (1B/3B) models

### Visual Feed Enhancement
- **🟢 Green badges** - High-quality "Signal" content (score 80-100)
- **🟡 Yellow badges** - Medium quality content (score 40-79)  
- **🔴 Red badges** - Low-quality "Noise" content (score 0-39)
- **Colored borders** - Quick visual scanning with left border indicators
- **Score percentages** - Exact quality scores on each tweet

### Real-time Dashboard
Floating dashboard (bottom-right) shows:
- Live signal/noise ratio percentage
- ECG-style waveform visualization 
- Total tweets analyzed counter
- Connection status indicator
- Quick refresh button

### Advanced Features
- **Settings Export/Import**: Backup and share your configurations
- **Performance Queue**: Optimized batch processing for smooth scrolling
- **Open Source**: Full transparency and community-driven development

## 📦 Installation

### Prerequisites

You need Ollama installed and running with at least one model:

```bash
# Install Ollama
# macOS
brew install ollama
ollama serve

# Linux  
curl -fsSL https://ollama.com/install.sh | sh
ollama serve

# Windows
# Download from https://ollama.com
```

### Download a Model

```bash
# Recommended - Fast and capable (5GB)
ollama pull qwen3:latest

# Alternative options:
ollama pull qwen2.5:7b   # Most capable (4.7GB)
ollama pull llama3.2:3b  # Balanced (2GB)
ollama pull llama3.2:1b  # Fastest (1.3GB)
```

### Install the Extension

1. **Download the extension**
   ```bash
   git clone https://github.com/yourusername/signal_noise_ratio.git
   cd signal_noise_ratio
   npm run build  # Creates production build in dist/
   ```

2. **Start the local server**
   ```bash
   cd server
   npm install  # First time only
   npm start    # Runs on port 3001
   ```

3. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the `dist/` folder (production build)

4. **Navigate to X.com**
   - Go to [x.com](https://x.com) or [twitter.com](https://twitter.com)
   - Badges should appear on tweets immediately
   - Look for the dashboard in bottom-right corner

## 🤖 How It Works

### Architecture

```
X.com Page
    ↓
Chrome Extension (Content Script)
    ↓
Local Server (Port 3001)
    ↓
Ollama API (Port 11434)
    ↓
Local LLM (Qwen/Llama)
```

### Analysis Pipeline

1. **Tweet Detection**: MutationObserver watches for new tweets in the DOM
2. **Pre-filtering**: Extremely obvious spam/quality (95%+ confidence) caught early
3. **LLM Analysis**: Tweet text sent to local Ollama instance
4. **Scoring**: Model returns 0-100 score with reasoning
5. **Visual Update**: Badges and borders applied based on score
6. **Dashboard Update**: Statistics aggregated and displayed

### Scoring Categories

- **High Signal (80-100)**: 🟢 Green - Breaking news, research, educational content
- **Signal (threshold-79)**: 🟢 Green - Quality content above your threshold
- **Medium (40-threshold)**: 🟡 Yellow - Mixed quality, personal opinions
- **Noise (0-39)**: 🔴 Red - Spam, clickbait, low-effort content

## 🎮 Usage

### Basic Operation

Once installed, the extension works automatically:
- Analyzes tweets as they appear
- Updates in real-time while scrolling
- Maintains connection to local LLM
- Shows connection status in extension badge

### Keyboard Shortcuts

- **Ctrl+Shift+T** - Toggle training mode (if available)
- **Ctrl+Shift+R** - Force re-analyze visible tweets
- **Ctrl+Shift+T** - Toggle training mode

### Settings

Access via extension icon → Settings:

- **Score Threshold**: Adjust signal/noise cutoff (default: 30)
- **Batch Size**: Tweets to analyze at once (default: 5)
- **Show Indicators**: Toggle visual badges
- **Auto-hide Noise**: Blur low-quality tweets
- **Debug Mode**: Show detailed logs
- **Training Mode**: Collect data for model improvement

## 🏗️ Project Structure

```
signal_noise_ratio/
├── manifest.json          # Chrome extension config
├── content/              # Core extension scripts
│   ├── content.js       # Main orchestrator
│   ├── analyzer.js      # Tweet analysis logic
│   ├── llm-service.js   # Ollama connection
│   ├── styles.css       # Visual indicators
│   └── waveform.js      # Dashboard visualization
├── background/           # Service worker
│   └── background.js    # Settings & messaging
├── server/              # Local Node.js server
│   ├── index.js        # Express + WebSocket server
│   ├── ollama-client.js # Ollama API integration
│   └── logger.js       # Structured logging
├── popup/               # Extension popup
├── options/             # Settings page
└── tests/              # Test scripts
```

## 🧪 Testing

### Quick Health Check

```bash
# Check Ollama
ollama list  # Should show your models

# Check server
curl http://localhost:3001/health | jq '.'
# Should show: {"status":"ok","ollama":{"connected":true,...}}
```

### Test in Browser

```javascript
// Paste in DevTools Console on X.com
console.log('Badges:', document.querySelectorAll('.sn-badge').length);
console.log('Dashboard:', !!document.querySelector('.sn-dashboard'));
```

### Run Test Suite

```bash
cd server
node test-tweet-analysis.js
```

## 🔧 Troubleshooting

### No Badges Appearing?

1. **Check Ollama is running**
   ```bash
   ollama list  # Should list models
   ```

2. **Check server is running**
   ```bash
   curl http://localhost:3001/health
   ```

3. **Check extension badge**
   - Green "ON" = Connected
   - Red "OFF" = Disconnected

4. **Check extension status**
   - Extension badge should show "ON" when connected
   - Visit X.com and look for colored badges on tweets

### Slow Analysis?

- Try a smaller model (llama3.2:1b)
- Reduce batch size in settings
- Check CPU usage - Ollama needs resources

### Connection Issues?

The server automatically retries connection with exponential backoff. Check:
```bash
tail -f server/server.log | jq '.'
```

## 🔐 Privacy & Security

- **100% Local**: No data ever leaves your machine
- **No Tracking**: Zero analytics or telemetry
- **No Cloud APIs**: Completely offline capable
- **Open Source**: Fully auditable code
- **Secure Storage**: Settings in Chrome's encrypted storage

## 🚀 Performance Tips

### Model Selection

| Model | Size | Speed | Quality | RAM Needed |
|-------|------|-------|---------|------------|
| llama3.2:1b | 1.3GB | Fastest | Good | 2GB |
| llama3.2:3b | 2GB | Fast | Better | 4GB |
| qwen3:latest | 5GB | Medium | Best | 8GB |
| qwen2.5:7b | 4.7GB | Slower | Excellent | 8GB |

### Optimization

- **Pre-warming**: First analysis is slower, then speeds up
- **Caching**: Recent analyses are cached for 1 hour
- **Queueing**: Tweets analyzed in optimized batches
- **Memory**: Keep Chrome memory under control with periodic refreshes

## 📝 Advanced Configuration

### Custom Prompts

Edit `server/ollama-client.js` to customize the analysis prompt:
```javascript
const customPrompt = `Your criteria here...`;
```

### Different Models

Set default model in `server/ollama-client.js`:
```javascript
this.defaultModel = 'qwen3:latest'; // or any model you have
```

### Server Configuration

Create `server/.env`:
```env
PORT=3001
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3:latest
```

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Test with local Ollama
4. Submit a pull request

### Development

```bash
# Watch mode for server
cd server
npm run dev

# Check connection status
window.SNR_DEBUG = true; // Enable detailed logging in browser console
```

## 📄 License

MIT License - see LICENSE file

## 🙏 Acknowledgments

- Powered by [Ollama](https://ollama.com) for local AI
- Built with Chrome Extension Manifest V3
- Inspired by the need for mindful social media consumption
- Thanks to the open-source AI community

---

**Note**: This extension requires a local Ollama installation to function. Without Ollama running, tweets will not be analyzed. This is by design - your data never leaves your machine.