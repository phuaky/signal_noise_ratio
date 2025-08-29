# Signal/Noise Ratio - Technical Architecture

## System Overview

Signal/Noise Ratio is a privacy-first Chrome extension that analyzes tweet quality using local AI models through Ollama. The system is designed with a local-first architecture where no user data leaves their machine.

## Architecture Diagram

```
┌─────────────────┐    ┌───────────────────┐    ┌─────────────────┐
│   X.com Page    │    │  Chrome Extension │    │  Local Server   │
│                 │    │                   │    │                 │
│  ┌───────────┐  │    │  ┌─────────────┐  │    │  ┌───────────┐  │
│  │   Tweets  │◄─┼────┼─►│Content Script│◄─┼────┼─►│Express API│  │
│  │           │  │    │  │             │  │    │  │           │  │
│  │  + Badges │  │    │  │ Analyzer    │  │    │  │WebSocket  │  │
│  └───────────┘  │    │  │ LLM Service │  │    │  └───────────┘  │
└─────────────────┘    │  │ UI Manager  │  │    │         │       │
                       │  └─────────────┘  │    │  ┌───────▼────┐  │
┌─────────────────┐    │                   │    │  │Ollama Client│  │
│Extension Settings│◄───┼──► Options Page   │    │  └───────────┘  │
└─────────────────┘    │                   │    └─────────┼───────┘
                       │   Background      │              │
                       │   Service Worker  │              │
                       └───────────────────┘              │
                                                          │
                                              ┌───────────▼───────────┐
                                              │     Ollama API        │
                                              │                       │
                                              │  ┌─────────────────┐  │
                                              │  │  Local Models   │  │
                                              │  │                 │  │
                                              │  │ llama3.2:1b     │  │
                                              │  │ llama3.2:3b     │  │
                                              │  │ qwen3:latest    │  │
                                              │  │ qwen2.5:7b      │  │
                                              │  └─────────────────┘  │
                                              └───────────────────────┘
```

## Core Components

### 1. Chrome Extension Layer

#### Content Scripts (`content/`)

**content.js** - Main orchestrator
- Initializes all other components
- Manages MutationObserver for new tweets
- Coordinates analysis workflow
- Handles UI updates and visual indicators
- Manages settings synchronization

**analyzer.js** - Tweet analysis logic
- Extracts tweet data from DOM elements
- Handles local LLM communication
- Processes analysis results
- Manages caching of analyzed tweets

**llm-service.js** - Ollama communication
- WebSocket connection to local server
- Request queuing and retry logic
- Connection health monitoring
- Rate limiting and error handling

**waveform.js** - Dashboard visualization
- Real-time signal/noise ratio display
- ECG-style waveform animation
- Statistics aggregation and display

#### Background Service Worker (`background/`)

**background.js** - Extension lifecycle management
- Settings storage and synchronization
- Inter-component message passing
- Extension badge status updates
- Permission management

#### User Interface (`popup/`, `options/`)

**popup.js/popup.html** - Extension popup interface
- Quick status overview
- Basic controls and settings
- Connection status display

**options.js/options.html** - Settings page
- Comprehensive configuration options
- Analysis method selection (local only)
- Visual indicator preferences
- Advanced settings and diagnostics

### 2. Local Server Layer (`server/`)

#### Express API Server (`index.js`)

**Core Endpoints:**
- `GET /health` - Server and Ollama status
- `POST /analyze` - Single tweet analysis
- `POST /analyze-batch` - Batch tweet analysis
- WebSocket endpoint for real-time communication

**Features:**
- CORS configuration for extension security
- Request logging and monitoring
- Error handling and graceful degradation
- Automatic retry logic

#### Ollama Client (`ollama-client.js`)

**Responsibilities:**
- Ollama API integration
- Model management and selection
- Prompt engineering and optimization
- Response parsing and validation
- Connection pooling and health checks

**Supported Analysis Methods:**
- Single-agent analysis (current implementation)
- Multi-agent analysis (disabled, code available)
- Custom prompt templates
- Model-specific optimizations

### 3. AI/ML Layer

#### Model Integration

**Supported Models:**
- **llama3.2:1b** - Fastest, 1.3GB, good for real-time analysis
- **llama3.2:3b** - Balanced, 2GB, good performance/quality ratio
- **qwen3:latest** - High quality, 5GB, best analysis accuracy
- **qwen2.5:7b** - Highest quality, 4.7GB, most accurate results

**Analysis Pipeline:**
1. Tweet text preprocessing
2. Context extraction (author, metrics, media)
3. Prompt template construction
4. LLM inference
5. Response parsing and scoring
6. Result caching and return

## Data Flow

### Tweet Analysis Workflow

1. **Detection Phase**
   ```
   MutationObserver → New Tweet Elements → Extract Data
   ```

2. **Analysis Phase**
   ```
   Tweet Data → LLM Service → Local Server → Ollama → Response
   ```

3. **Processing Phase**
   ```
   LLM Response → Score Calculation → UI Update → Cache Storage
   ```

4. **Display Phase**
   ```
   Analysis Result → Visual Badges → Dashboard Update → Statistics
   ```

### Message Flow

```
Content Script ←→ Background Worker ←→ Local Server ←→ Ollama API
     ↑                                                      ↑
     ↓                                                      ↓
   DOM/UI ←←←←←←←←← Analysis Results ←←←←←←←←← Model Response
```

## Security Architecture

### Privacy Principles

1. **Local-First Processing**
   - All analysis happens on user's machine
   - No data transmission to external services
   - Tweet content never leaves local environment

2. **Secure Communication**
   - Extension ↔ Server: HTTP over localhost only
   - Server ↔ Ollama: HTTP over localhost only
   - No external network requests for analysis

3. **Data Minimization**
   - Only necessary tweet data extracted
   - Minimal logging and storage
   - User can clear all data anytime

4. **Permission Model**
   - Minimal Chrome permissions requested
   - Host permissions limited to X.com and localhost
   - No background network access

### Threat Model

**Protected Against:**
- Data exfiltration to external services
- Network-based attacks (air-gapped analysis)
- Cross-site scripting (content script isolation)
- Data persistence attacks (optional storage only)

**Assumptions:**
- User's machine is trusted
- Local Ollama installation is trusted
- Chrome extension sandbox is effective
- Network requests to localhost are secure

## Performance Architecture

### Optimization Strategies

1. **Lazy Loading**
   - Components loaded only when needed
   - Models loaded on first analysis request
   - UI elements created on demand

2. **Caching**
   - Analysis results cached for 1 hour
   - Tweet data deduplicated
   - Settings cached in memory

3. **Batching**
   - Multiple tweets analyzed together
   - Request queuing to prevent overload
   - Rate limiting for smooth scrolling

4. **Asynchronous Processing**
   - Non-blocking analysis pipeline
   - Background processing queue
   - Progressive UI updates

### Resource Management

**Memory:**
- Tweet cache limited to 1000 entries
- Periodic cleanup of old results
- Efficient DOM element references

**CPU:**
- Analysis throttled to prevent UI blocking
- Model inference happens in separate process
- Background task prioritization

**Network:**
- Local-only communication minimizes latency
- Connection pooling for efficiency
- Automatic retry with exponential backoff

## Extension Points

### Adding New Models

1. **Server Configuration** (`ollama-client.js`)
   ```javascript
   this.supportedModels = [
     'llama3.2:1b',
     'llama3.2:3b',
     'qwen3:latest',
     'your-model:tag'  // Add here
   ];
   ```

2. **Model-Specific Prompts**
   ```javascript
   getModelSpecificPrompt(modelName, content) {
     switch(modelName) {
       case 'your-model:tag':
         return this.buildCustomPrompt(content);
       default:
         return this.buildDefaultPrompt(content);
     }
   }
   ```

### Adding New Analysis Features

1. **Extend Tweet Data Extraction** (`analyzer.js`)
   ```javascript
   extractTweetData(element) {
     return {
       // ... existing fields
       newFeature: this.extractNewFeature(element)
     };
   }
   ```

2. **Update Analysis Logic** (`ollama-client.js`)
   ```javascript
   buildContentPrompt(text, tweetData) {
     // Include new feature in prompt
     const prompt = `... consider ${tweetData.newFeature} ...`;
     return prompt;
   }
   ```

### Adding Cloud API Support

The architecture is designed to easily add cloud API support:

1. **Modify Analyzer** (`analyzer.js`)
   ```javascript
   async analyzeTweet(tweetElement, options = {}) {
     // ... existing local logic
     
     if (this.settings.useCloudAPI && this.settings.apiKey) {
       return await this.analyzeWithCloudAPI(tweetData);
     }
   }
   ```

2. **Add Cloud Service** (`cloud-service.js`)
   ```javascript
   class CloudService {
     async analyzeTweet(tweetData, apiKey) {
       // Implementation for cloud API calls
     }
   }
   ```

## Build and Deployment

### Development Build

```bash
# Development server with hot reload
cd server && npm run dev

# Load extension directly from source
chrome://extensions/ → Load unpacked → Select project root
```

### Production Build

```bash
# Create optimized build
npm run build

# Output in dist/ directory
# Load dist/ folder in Chrome for production testing
```

### Build Process

1. **Clean** - Remove previous build artifacts
2. **Copy** - Copy source files to dist/
3. **Optimize** - Remove debug code and comments
4. **Validate** - Check manifest and dependencies
5. **Package** - Create extension-ready directory

## Monitoring and Observability

### Logging Architecture

**Structured Logging** (`utils/logger.js`)
- Configurable log levels (ERROR, WARN, INFO, DEBUG)
- Context-aware logging with metadata
- Performance timing integration
- Optional log storage for debugging

**Log Destinations:**
- Browser DevTools Console
- Chrome Extension Storage (optional)
- Server log files (structured JSON)

### Metrics and Analytics

**Performance Metrics:**
- Analysis latency per tweet
- Model inference time
- UI update performance
- Memory usage patterns

**Usage Analytics:**
- Tweet analysis success/failure rates
- Model performance comparisons
- Feature usage statistics
- Error frequency and types

**Privacy Note:** All metrics remain local to user's machine.

## Future Architecture Considerations

### Scalability

- **Multi-tab support**: Shared analysis cache across tabs
- **Offline capability**: Local storage of analysis results
- **Model switching**: Runtime model selection and comparison

### Extensibility

- **Plugin system**: Third-party analysis modules
- **Custom models**: User-provided fine-tuned models
- **API exposure**: Allow other extensions to use analysis

### Performance

- **WebAssembly**: Client-side model inference
- **Background analysis**: Pre-analyze visible tweets
- **Incremental updates**: Partial re-analysis on scroll

---

This architecture document serves as a comprehensive reference for developers working on Signal/Noise Ratio. The system is designed to be modular, extensible, and privacy-preserving while maintaining excellent performance and user experience.