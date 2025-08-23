# Signal/Noise Ratio Extension - Testing Guide

## 🚀 Quick Test Procedure

### Step 1: Load the Extension
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the folder: `/Users/pky/Code/signal_noise_ratio`
5. You should see "Signal/Noise Ratio for X" appear in your extensions list

### Step 2: Navigate to X.com
1. Go to [x.com](https://x.com) and log in if needed
2. Navigate to your home feed (x.com/home)
3. The extension icon should appear in your Chrome toolbar

### Step 3: Run the Diagnostic Test
1. Open Chrome DevTools (F12 or right-click → Inspect)
2. Go to the **Console** tab
3. Copy and paste the contents of `test-extension.js` into the console
4. Press Enter to run

## 📊 What You Should See

### Visual Indicators on Tweets
- **Green badges** (🟢) on high-quality "Signal" tweets
- **Red badges** (🔴) on low-quality "Noise" tweets  
- **Colored left borders** matching the classification
- **Score percentages** (e.g., "85% Signal")

### Dashboard (Bottom-Right Corner)
- **Real-time statistics** showing signal/noise ratio
- **Waveform visualization** showing feed quality
- **Tweet counter** showing analyzed tweets
- **Refresh button** to re-analyze visible tweets

### Expected Classifications

#### High Signal (Green) Examples:
- Research papers with links
- Educational threads
- Breaking news from verified sources
- Technical discussions
- Data-driven content

#### Noise (Red) Examples:
- ALL CAPS rage posts
- Excessive emoji spam (😂😂😂😂)
- "You won't BELIEVE..." clickbait
- Engagement farming ("RT for good luck!")
- Very short replies with no substance

## 🧪 Testing Different Modes

### 1. Heuristic Mode (Default)
- Instant analysis using patterns
- No API required
- Free and private

**Test:** Should work immediately after loading extension

### 2. Local LLM Mode (Ollama)
- Start the server:
  ```bash
  cd /Users/pky/Code/signal_noise_ratio/server
  npm start
  ```
- Enable in extension settings
- Uses your local AI model

**Test:** Run `curl http://localhost:3001/health` to verify

### 3. Cloud AI Mode
- Requires API key (Claude or OpenAI)
- Most accurate but costs money
- Configure in extension settings

## 🔍 Debugging Checklist

### Extension Not Working?

1. **Check Extension Status**
   ```javascript
   // Paste in console on X.com
   console.log('Badges:', document.querySelectorAll('.sn-badge').length);
   console.log('Dashboard:', !!document.querySelector('.sn-dashboard'));
   ```

2. **Check for Errors**
   - Open DevTools Console
   - Look for red error messages
   - Check the extension service worker (chrome://extensions/ → Details → Service Worker)

3. **Enable Debug Mode**
   - Press `Ctrl+Shift+D` on X.com
   - Check console for detailed logs

4. **Manual Refresh**
   - Click the refresh button in the dashboard
   - Or reload the page (F5)

## 📈 Performance Testing

### Monitor Resource Usage
1. Open Chrome Task Manager (Shift+Esc)
2. Look for "Signal/Noise Ratio" entry
3. Memory should stay under 50MB
4. CPU should be minimal (<1%)

### Test Scrolling Performance
1. Scroll quickly through your feed
2. New tweets should get badges within 1-2 seconds
3. No page lag or freezing

## 🎯 Test Scenarios

### Scenario 1: Fresh Install
1. Load extension
2. Navigate to X.com
3. Should see badges appear immediately

### Scenario 2: Settings Change
1. Click extension icon
2. Change threshold to 70%
3. Badges should update in real-time

### Scenario 3: Local LLM
1. Start server: `npm start`
2. Enable "Use Local LLM" in settings
3. New tweets should use AI analysis

### Scenario 4: Stress Test
1. Scroll continuously for 30 seconds
2. Check memory usage
3. Verify all tweets have badges

## 📝 Console Commands

```javascript
// Get current statistics
window.SNR_TEST

// Force re-analysis
window.postMessage({ type: 'SNR_ANALYZE_VISIBLE' }, '*');

// Check extension version
chrome.runtime.getManifest().version

// View current settings
chrome.storage.local.get(null, console.log);

// Clear all data and reset
chrome.storage.local.clear();
```

## ✅ Success Criteria

The extension is working correctly if:
1. ✅ Badges appear on tweets
2. ✅ Dashboard shows statistics
3. ✅ No console errors
4. ✅ Settings changes apply immediately
5. ✅ Memory usage stays reasonable
6. ✅ Scroll performance is smooth

## 🐛 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| No badges appearing | Reload extension in chrome://extensions/ |
| Dashboard missing | Refresh the X.com page |
| Server connection failed | Check if port 3001 is free |
| Slow analysis | Switch to heuristic mode |
| High memory usage | Disable debug mode |

## 📊 Test Results Template

```
Date: [TODAY]
Chrome Version: [VERSION]
Extension Version: 1.0.0

✅ Extension loads
✅ Badges appear
✅ Dashboard visible
✅ Heuristic analysis works
✅ Local LLM connects
✅ Settings persist
✅ Performance acceptable

Signal/Noise Ratio: [X]%
Tweets Analyzed: [N]
Mode: [Heuristic/Local/Cloud]
```

## 🚀 Quick Commands

```bash
# Start local server
cd /Users/pky/Code/signal_noise_ratio/server && npm start

# Test server health
curl http://localhost:3001/health | jq '.'

# Run comprehensive tests
node test-tweet-analysis.js

# Monitor server logs
tail -f server/server.log
```