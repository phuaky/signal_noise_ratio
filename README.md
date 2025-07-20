# Signal/Noise Ratio for X (Twitter)

A Chrome extension that helps you combat social media brain rot by visualizing the signal-to-noise ratio of your X (Twitter) feed in real-time.

**NEW:** Now with local LLM support for private, intelligent tweet analysis using Ollama!

![Signal/Noise Ratio Demo](demo.png)

## Features

- **Real-time Analysis**: Automatically analyzes tweets as you scroll
- **Visual Indicators**: Color-coded badges show signal vs noise scores
- **Floating Dashboard**: Live statistics about your feed quality
- **Auto-hide Noise**: Optionally blur low-value tweets
- **Customizable Thresholds**: Adjust what counts as signal vs noise
- **Local LLM Support**: Private AI analysis using Ollama (NEW!)
- **Cloud AI Integration**: Optional Claude or GPT for comparison
- **Privacy-First**: All analysis happens locally by default

## Installation

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/yourusername/signal_noise_ratio.git
   ```

2. **Open Chrome Extensions**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right

3. **Load the extension**
   - Click "Load unpacked"
   - Select the `signal_noise_ratio` folder

4. **Pin the extension**
   - Click the puzzle piece icon in Chrome toolbar
   - Pin "Signal/Noise Ratio for X"

## Usage

### Basic Usage

1. Navigate to [X.com](https://x.com) or [Twitter.com](https://twitter.com)
2. The extension will automatically start analyzing tweets
3. Look for colored indicators on each tweet:
   - 🟢 **Green**: High signal content
   - 🔴 **Red**: Low signal/noise content

### Popup Interface

Click the extension icon to see:
- Current signal/noise statistics
- Real-time ratio chart
- Quick toggle controls

### Settings

Access the full settings page by clicking "Settings" in the popup:

- **Analysis Method**: Choose between heuristic (local) or AI-powered analysis
- **Display Options**: Toggle indicators, auto-hide, and dashboard
- **Thresholds**: Adjust sensitivity for signal detection
- **Personal Interests**: Add keywords to personalize analysis

## Local LLM Setup (Recommended)

For the best privacy and performance, use a local LLM:

### 1. Install Ollama
```bash
# macOS
brew install ollama
brew services start ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Download a Model
```bash
# Fast and lightweight (recommended)
ollama pull llama3.2:1b

# More capable but slower
ollama pull llama3.2:3b
```

### 3. Start the Local Server
```bash
cd signal_noise_ratio/server
npm install
npm start
```

### 4. Enable in Extension Settings
1. Click the extension icon
2. Go to Settings
3. Select "Local LLM (Ollama)"
4. The extension will automatically connect

## How It Works

### Heuristic Analysis (Default)

The extension uses multiple signals to determine tweet quality:

**Positive Signals:**
- External links to articles/resources
- Thread posts with multiple tweets
- Longer, substantive text
- Verified accounts
- Media attachments

**Negative Signals:**
- Excessive CAPS LOCK
- High emoji density
- Rage bait keywords
- Very short text
- Reply chains

### Local LLM Analysis (Recommended)

Uses Ollama with Llama 3.2 for intelligent analysis:
- **100% Private**: Your data never leaves your machine
- **Fast**: ~500ms per tweet after warmup
- **Smart**: Understands context and nuance
- **Personalized**: Learns your interests

### Cloud AI Analysis (Optional)

For more accurate analysis, you can enable AI mode:

1. Get an API key from [Anthropic](https://console.anthropic.com) or [OpenAI](https://platform.openai.com)
2. Open extension settings
3. Select "AI-Powered Analysis"
4. Enter your API key
5. Save settings

**Cost estimate**: ~\$0.01 per 1000 tweets analyzed (Local LLM is free!)

## Customization

### Adjusting Thresholds

The noise threshold determines the cutoff between signal and noise:
- **Lower threshold** (e.g., 20%): More tweets marked as signal
- **Higher threshold** (e.g., 40%): Stricter filtering

### Personal Interests

Add topics you care about to improve signal detection:
```
AI/ML
Web Development
Science
Climate Change
```

### Visual Preferences

- **Show Indicators**: Toggle badge visibility
- **Auto-hide Noise**: Blur low-signal tweets
- **Show Dashboard**: Toggle floating stats panel

## Privacy & Security

- **Local by default**: Heuristic analysis runs entirely in your browser
- **No data collection**: The extension doesn't track or store your browsing
- **API keys**: Stored locally in Chrome, never transmitted except to chosen API
- **Open source**: All code is transparent and auditable

## Development

### Project Structure
```
signal_noise_ratio/
├── manifest.json          # Extension configuration
├── server/               # Local LLM server (NEW!)
│   ├── index.js         # Express server
│   ├── ollama-client.js # Ollama integration
│   └── package.json
├── popup/                 # Extension popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── content/              # Tweet analysis scripts
│   ├── content.js
│   ├── analyzer.js
│   ├── llm-service.js   # LLM communication
│   └── styles.css
├── background/           # Service worker for API calls
│   └── background.js
├── options/              # Settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
└── assets/              # Icons and images
    └── icons/
```

### Building from Source

No build process required! The extension runs directly from source.

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Troubleshooting

### Extension not working?

1. Make sure you're on X.com or Twitter.com
2. Refresh the page after installing
3. Check that the extension is enabled in Chrome

### No indicators showing?

1. Check popup to ensure analysis is active
2. Verify "Show indicators" is enabled in settings
3. Try refreshing the page

### API errors?

1. Verify your API key is correct
2. Check you have credits/balance with your provider
3. Fall back to heuristic mode if issues persist

## Future Enhancements

- [ ] Firefox support
- [ ] Custom training via user feedback
- [ ] Export analytics and insights
- [ ] Keyword filtering
- [ ] Time-based statistics
- [ ] Integration with other social platforms

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Inspired by the need to make social media more intentional
- Uses Chrome Extension Manifest V3
- Optional integration with Claude and GPT APIs

---

**Remember**: This tool is meant to help you be more mindful of your social media consumption. The goal isn't to eliminate all "noise" but to be aware of the quality of content you're engaging with.