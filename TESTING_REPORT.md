# Signal/Noise Ratio Extension - Manual Testing Report

## Test Date: August 23, 2025

## Overview
The Signal/Noise Ratio Chrome extension is designed to analyze tweets on X (Twitter) and classify them as either "Signal" (high-quality content) or "Noise" (low-quality content). Based on my code review, here's what the extension SHOULD be doing and how to verify if it's working.

## What the Extension Should Do

### Visual Indicators on Each Tweet:
1. **Colored Badge** - Should appear on each tweet showing:
   - Score percentage (e.g., "75%")
   - Label ("Signal" or "Noise")
   - Color coding:
     - 🟢 Green = Signal (high-quality)
     - 🔴 Red = Noise (low-quality)
     - 🟡 Yellow = Medium quality

2. **Left Border** - Each tweet should have a colored left border:
   - Green border for signal tweets
   - Red border for noise tweets
   - Yellow border for medium quality

### Dashboard (Bottom-Right Corner):
- Floating panel showing:
  - Signal count
  - Noise count
  - Ratio percentage
  - Real-time waveform or chart

### Analysis Methods:
The extension uses three possible analysis methods:

1. **Heuristic Analysis** (Default - No setup required):
   - Analyzes based on patterns like:
     - ✅ Positive signals: External links, threads, long text, verified accounts, media
     - ❌ Negative signals: Excessive CAPS, emoji spam, rage bait keywords, very short text

2. **Local LLM** (Requires server running):
   - Uses Ollama with Llama model
   - More intelligent context-aware analysis

3. **Cloud AI** (Requires API key):
   - Uses Claude or GPT for analysis

## Manual Testing Checklist

### Step 1: Verify Extension is Loaded
1. ✅ Go to `chrome://extensions/`
2. ✅ Check if "Signal/Noise Ratio for X" is listed
3. ✅ Verify it's enabled (toggle should be ON)
4. ✅ Note the extension ID (you'll see it in the details)

### Step 2: Check X.com Page
1. Navigate to https://x.com/home
2. Open Chrome DevTools (F12)
3. Go to Console tab
4. Paste and run this diagnostic code:

```javascript
// Extension Diagnostic Script
console.log('=== Signal/Noise Extension Diagnostic ===\n');

// Check for extension elements
const diagnostics = {
  // Check for badges on tweets
  badges: document.querySelectorAll('.sn-badge').length,
  indicators: document.querySelectorAll('.sn-indicator').length,
  
  // Check for dashboard
  dashboard: !!document.querySelector('.sn-dashboard'),
  dashboardVisible: document.querySelector('.sn-dashboard')?.style.display !== 'none',
  
  // Check for waveform
  waveform: !!document.querySelector('#sn-waveform'),
  
  // Check tweet analysis
  tweets: document.querySelectorAll('article[data-testid="tweet"]').length,
  tweetsWithBorders: Array.from(document.querySelectorAll('article[data-testid="tweet"]'))
    .filter(t => t.style.borderLeft).length,
  
  // Check for extension's data attributes
  analyzedTweets: document.querySelectorAll('[data-snr-analyzed]').length,
  signalTweets: document.querySelectorAll('[data-snr-signal="true"]').length,
  noiseTweets: document.querySelectorAll('[data-snr-noise="true"]').length
};

// Display results
console.log('📊 DIAGNOSTIC RESULTS:');
console.log('------------------------');
console.log(`Tweets on page: ${diagnostics.tweets}`);
console.log(`Tweets with badges: ${diagnostics.badges}`);
console.log(`Tweets with indicators: ${diagnostics.indicators}`);
console.log(`Tweets with colored borders: ${diagnostics.tweetsWithBorders}`);
console.log(`Dashboard present: ${diagnostics.dashboard}`);
console.log(`Dashboard visible: ${diagnostics.dashboardVisible}`);
console.log(`Waveform element: ${diagnostics.waveform}`);
console.log('');
console.log('📈 ANALYSIS STATS:');
console.log(`Analyzed tweets: ${diagnostics.analyzedTweets}`);
console.log(`Signal tweets: ${diagnostics.signalTweets}`);
console.log(`Noise tweets: ${diagnostics.noiseTweets}`);

// Determine status
if (diagnostics.badges > 0 || diagnostics.indicators > 0) {
  console.log('\n✅ Extension appears to be WORKING!');
} else if (diagnostics.tweets === 0) {
  console.log('\n⚠️ No tweets found on page. Try scrolling or refreshing.');
} else {
  console.log('\n❌ Extension NOT working properly.');
  console.log('\nTroubleshooting steps:');
  console.log('1. Refresh the page (Ctrl+R)');
  console.log('2. Check extension is enabled in chrome://extensions/');
  console.log('3. Click extension icon in toolbar to check status');
  console.log('4. Check for errors in Console (red text)');
}

// Try to trigger analysis manually
console.log('\n🔄 Attempting to trigger manual analysis...');
window.postMessage({ type: 'SNR_ANALYZE_VISIBLE' }, '*');

// Check for specific tweet content
console.log('\n📝 Sample Tweet Analysis:');
const firstThreeTweets = Array.from(document.querySelectorAll('article[data-testid="tweet"]')).slice(0, 3);
firstThreeTweets.forEach((tweet, i) => {
  const text = tweet.querySelector('[data-testid="tweetText"]')?.innerText || 'No text';
  const badge = tweet.querySelector('.sn-badge');
  const score = badge?.querySelector('.sn-score')?.innerText || 'N/A';
  const label = badge?.querySelector('.sn-label')?.innerText || 'N/A';
  
  console.log(`\nTweet ${i + 1}:`);
  console.log(`  Text: "${text.substring(0, 80)}..."`);
  console.log(`  Score: ${score}`);
  console.log(`  Classification: ${label}`);
});
```

### Step 3: Check Extension Popup
1. Click the Signal/Noise extension icon in toolbar
2. You should see:
   - Signal count
   - Noise count  
   - Ratio percentage
   - Waveform or chart visualization
   - Toggle controls

### Step 4: Test Heuristic Analysis
Look for these patterns in tweet classifications:

**Should be marked as SIGNAL (Green):**
- Tweets with external links to articles
- Thread tweets (multiple connected posts)
- Long-form content (>280 chars)
- Tweets from verified accounts
- Tweets with images/videos AND substantial text

**Should be marked as NOISE (Red):**
- Tweets with excessive CAPS LOCK
- Short tweets with many emojis 😂😂😂
- Rage bait ("You won't BELIEVE...")
- Very short replies
- Promotional/spam content

### Step 5: Test Local LLM (Optional)
If you want more intelligent analysis:

1. Check if Ollama is installed:
```bash
ollama --version
```

2. Start the local server:
```bash
cd /Users/pky/Code/signal_noise_ratio
./start-server.sh
```

3. Test the server:
```bash
curl http://localhost:3001/health
```

4. In extension settings, select "Local LLM (Ollama)"
5. Refresh X.com - tweets should now show AI-based analysis

## Current Status Assessment

### ❌ EXTENSION NOT WORKING

Based on the inability to execute JavaScript on the page, it appears the extension is either:
1. Not loaded in Chrome
2. Not enabled
3. Not properly injecting its content scripts
4. Has a JavaScript error preventing execution

## Recommended Actions

1. **Manual Load Extension:**
   - Open `chrome://extensions/`
   - Enable Developer Mode
   - Click "Load unpacked"
   - Select `/Users/pky/Code/signal_noise_ratio`

2. **Check for Errors:**
   - Open Chrome DevTools on X.com
   - Check Console for red error messages
   - Check if extension appears in Sources > Content Scripts

3. **Test Basic Functionality:**
   - Refresh X.com after loading extension
   - Look for green/red badges on tweets
   - Look for dashboard in bottom-right corner
   - Click extension icon to see if popup works

4. **Debug Mode:**
   - Press `Ctrl+Shift+D` on X.com to enable debug mode
   - This should show a debug panel with detailed logs

## Expected vs Actual Behavior

### Expected:
- Every tweet should have a colored badge (green/red)
- Dashboard should be visible in bottom-right
- Extension popup should show statistics
- Tweets should have colored left borders

### Actual (Based on Testing Attempts):
- Cannot verify due to Chrome automation issues
- Extension needs to be manually loaded and tested
- No visual indicators detected programmatically

## Conclusion

The extension code appears well-structured with three analysis modes (heuristic, local LLM, cloud AI). However, it's NOT currently active on your X.com page. You need to:

1. Manually load the extension in Chrome
2. Refresh X.com
3. Run the diagnostic script above to verify it's working
4. Check for any JavaScript errors in the console

The extension should work immediately with heuristic analysis (no setup required). For better AI-powered analysis, you can optionally set up the local Ollama server.
