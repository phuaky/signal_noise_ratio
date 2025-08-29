# Contributing to Signal/Noise Ratio

Thank you for your interest in contributing to Signal/Noise Ratio! This document provides guidelines for contributing to this open-source Chrome extension project.

## 🚀 Quick Start for Contributors

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/signal_noise_ratio.git
   cd signal_noise_ratio
   ```

2. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Set up Ollama for testing**
   ```bash
   # Install Ollama (if not already installed)
   brew install ollama  # macOS
   # or follow https://ollama.com/download
   
   # Pull a model for testing
   ollama pull llama3.2:1b  # Fastest for development
   ```

4. **Start development environment**
   ```bash
   # Terminal 1: Start Ollama
   ollama serve
   
   # Terminal 2: Start server in watch mode
   cd server
   npm run dev
   
   # Terminal 3: Load extension in Chrome
   # Go to chrome://extensions/ → Load unpacked → Select project root
   ```

### Project Structure

```
signal_noise_ratio/
├── assets/              # Extension icons
├── background/          # Service worker
├── content/             # Content scripts (main logic)
├── options/             # Settings page
├── popup/               # Extension popup
├── server/              # Local Node.js server
├── utils/               # Shared utilities
├── dev/                 # Development tools and tests
├── scripts/             # Build scripts
└── dist/                # Production build output
```

## 🛠️ Development Guidelines

### Code Style

- **JavaScript**: ES6+ syntax, prefer `const`/`let` over `var`
- **Functions**: Use arrow functions for callbacks, regular functions for methods
- **Naming**: Use camelCase for variables/functions, PascalCase for classes
- **Comments**: Document complex logic, avoid obvious comments
- **Error handling**: Always handle promises with try/catch or .catch()

### Architecture Principles

1. **Privacy First**: No data should ever leave the user's machine without explicit consent
2. **Local-First**: Core functionality must work with local Ollama only
3. **Performance**: Minimize impact on page load and scrolling
4. **Reliability**: Graceful degradation when services are unavailable

### Code Organization

#### Content Scripts (`content/`)

- `content.js` - Main orchestrator and UI management
- `analyzer.js` - Tweet analysis logic
- `llm-service.js` - Ollama communication
- `waveform.js` - Dashboard visualization
- Other utility modules

#### Server (`server/`)

- `index.js` - Express server and WebSocket handling
- `ollama-client.js` - Ollama API integration
- `logger.js` - Structured logging

### Testing

#### Manual Testing Checklist

Before submitting a PR, verify:

- [ ] Extension loads without errors in Chrome DevTools
- [ ] Server starts and connects to Ollama successfully
- [ ] Tweets get analyzed and display badges
- [ ] Settings page works and persists changes
- [ ] No console errors during normal usage
- [ ] Performance remains smooth while scrolling

#### Running Tests

```bash
# Run server tests
cd dev/server-tests
node test-suite.js

# Test extension functionality
# Load extension and visit X.com
# Check browser console for errors
```

## 📝 Making Changes

### Before You Start

1. **Check existing issues** - Look for related issues or discussions
2. **Create an issue** - For new features or major changes, create an issue first
3. **Small changes** - Bug fixes and small improvements can go directly to PR

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the existing code patterns
   - Keep changes focused and atomic
   - Test thoroughly

3. **Test your changes**
   ```bash
   # Build production version
   npm run build
   
   # Load dist/ folder in Chrome to test production build
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

### Commit Message Format

Use conventional commit format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code formatting (no functional changes)
- `refactor:` - Code restructuring
- `test:` - Adding or fixing tests
- `chore:` - Build process or auxiliary tool changes

Examples:
- `feat: add custom prompt configuration`
- `fix: resolve memory leak in analysis queue`
- `docs: update installation instructions`

## 🔧 Common Development Tasks

### Adding a New Feature

1. **Plan the architecture** - Consider impact on privacy and performance
2. **Update relevant components** - Usually content scripts and/or server
3. **Add settings if needed** - Extend options page and storage schema
4. **Test thoroughly** - Especially edge cases and error conditions
5. **Update documentation** - README, help text, code comments

### Debugging Issues

#### Extension Issues
```javascript
// Enable debug mode in browser console on X.com
window.SNR_DEBUG = true;

// Check extension status
chrome.storage.local.get(null, console.log);

// Monitor analysis results
window.addEventListener('snr-tweet-analyzed', console.log);
```

#### Server Issues
```bash
# Check server logs
tail -f server/server.log

# Test Ollama connection
curl http://localhost:11434/api/tags

# Test server health
curl http://localhost:3001/health
```

### Performance Optimization

- **Minimize DOM queries** - Cache selectors when possible
- **Batch operations** - Group API calls and DOM updates
- **Use IntersectionObserver** - For viewport-based processing
- **Debounce/throttle** - Rate-limit expensive operations
- **Memory management** - Clean up listeners and caches

## 🐛 Bug Reports

### Before Reporting

1. **Search existing issues** - Check if already reported
2. **Test with clean setup** - Disable other extensions
3. **Check browser console** - Look for error messages
4. **Verify Ollama is working** - Test with `curl http://localhost:11434/api/tags`

### Bug Report Template

```markdown
## Bug Description
Brief description of the issue

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [macOS/Windows/Linux]
- Chrome version: [e.g., 120.0.6099.109]
- Extension version: [e.g., 1.0.0]
- Ollama version: [e.g., 0.1.17]
- Model: [e.g., llama3.2:1b]

## Additional Context
- Console errors
- Screenshots
- Server logs (if relevant)
```

## 🌟 Feature Requests

### What We're Looking For

- **Privacy-preserving enhancements**
- **Performance improvements**
- **Better user experience**
- **Accessibility improvements**
- **Cross-platform compatibility**

### Not Currently Planned

- Features requiring cloud services (without opt-in)
- Closed-source dependencies
- Features that significantly impact performance
- Platform-specific functionality

## 📜 Pull Request Process

1. **Fork the repository** and create your feature branch
2. **Make your changes** following the guidelines above
3. **Test thoroughly** - Both development and production builds
4. **Update documentation** - If your changes affect usage
5. **Create pull request** - Use the template provided
6. **Respond to reviews** - Address feedback promptly
7. **Rebase if needed** - Keep history clean

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Other (please describe)

## Testing
- [ ] Tested locally with development setup
- [ ] Tested production build
- [ ] No console errors
- [ ] Verified on X.com with real tweets

## Screenshots (if applicable)
Add screenshots to help explain your changes

## Additional Notes
Any other context about the change
```

## 🤝 Code of Conduct

- **Be respectful** - Treat all contributors with respect
- **Be constructive** - Provide helpful feedback and suggestions
- **Be patient** - Remember this is a volunteer project
- **Focus on the code** - Keep discussions technical and objective
- **Help others** - Share knowledge and assist newcomers

## 🎉 Recognition

Contributors will be:
- Added to the contributor list in README.md
- Credited in release notes for significant contributions
- Given collaborator access for ongoing contributors

## 📞 Getting Help

- **GitHub Issues** - For bugs and feature requests
- **Discussions** - For general questions and ideas
- **Code Review** - Don't hesitate to ask for feedback on approaches

---

Thank you for contributing to Signal/Noise Ratio! Your contributions help make social media more mindful and privacy-respecting for everyone.