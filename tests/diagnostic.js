// Signal/Noise Ratio Extension - Complete Diagnostic & Testing Script
// Copy and paste this entire script into Chrome DevTools Console on X.com

(function() {
  console.clear();
  console.log('%c Signal/Noise Ratio Extension Diagnostics ', 'background: #3b82f6; color: white; padding: 5px 10px; border-radius: 5px; font-weight: bold; font-size: 14px');
  console.log('========================================\n');

  // Phase 1: Check Extension Presence
  console.log('%c📍 Phase 1: Extension Detection', 'color: #3b82f6; font-weight: bold; font-size: 12px');
  
  const extensionElements = {
    badges: document.querySelectorAll('.sn-badge'),
    indicators: document.querySelectorAll('.sn-indicator'), 
    dashboard: document.querySelector('.sn-dashboard'),
    waveform: document.querySelector('#sn-waveform'),
    chart: document.querySelector('#sn-mini-chart'),
    debugPanel: document.querySelector('.snr-debug-panel')
  };

  const extensionPresent = Object.values(extensionElements).some(el => el && (el.length > 0 || el !== null));
  
  if (extensionPresent) {
    console.log('✅ Extension elements detected');
    Object.entries(extensionElements).forEach(([key, value]) => {
      const count = value ? (value.length !== undefined ? value.length : 1) : 0;
      if (count > 0) {
        console.log(`  ✓ ${key}: ${count}`);
      }
    });
  } else {
    console.log('❌ No extension elements found');
    console.log('  → Extension may not be loaded or enabled');
  }

  // Phase 2: Tweet Analysis
  console.log('\n%c📊 Phase 2: Tweet Analysis', 'color: #3b82f6; font-weight: bold; font-size: 12px');
  
  const tweets = document.querySelectorAll('article[data-testid="tweet"]');
  console.log(`Found ${tweets.length} tweets on page`);
  
  if (tweets.length > 0) {
    let signalCount = 0;
    let noiseCount = 0;
    let unanalyzedCount = 0;
    
    const tweetDetails = [];
    
    tweets.forEach((tweet, index) => {
      if (index >= 5) return; // Analyze first 5 tweets only
      
      const tweetText = tweet.querySelector('[data-testid="tweetText"]')?.innerText || '';
      const author = tweet.querySelector('[data-testid="User-Name"]')?.innerText || 'Unknown';
      const badge = tweet.querySelector('.sn-badge');
      const indicator = tweet.querySelector('.sn-indicator');
      const borderStyle = tweet.style.borderLeft;
      
      let classification = 'Unanalyzed';
      let score = 'N/A';
      
      if (badge) {
        const scoreEl = badge.querySelector('.sn-score');
        const labelEl = badge.querySelector('.sn-label');
        if (scoreEl) score = scoreEl.innerText;
        if (labelEl) classification = labelEl.innerText;
        
        if (classification === 'Signal') signalCount++;
        else if (classification === 'Noise') noiseCount++;
      } else {
        unanalyzedCount++;
      }
      
      // Check for heuristic signals
      const hasLink = tweet.querySelector('a[href*="http"]') !== null;
      const hasMedia = tweet.querySelector('[data-testid="tweetPhoto"]') !== null || 
                      tweet.querySelector('[data-testid="videoPlayer"]') !== null;
      const isThread = tweet.querySelector('[aria-label*="Show this thread"]') !== null;
      const textLength = tweetText.length;
      const capsRatio = (tweetText.match(/[A-Z]/g) || []).length / textLength;
      const emojiCount = (tweetText.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
      
      tweetDetails.push({
        index: index + 1,
        author: author.substring(0, 30),
        text: tweetText.substring(0, 60) + '...',
        classification,
        score,
        signals: {
          hasLink,
          hasMedia,
          isThread,
          textLength,
          capsRatio: (capsRatio * 100).toFixed(1) + '%',
          emojiCount
        },
        hasBadge: !!badge,
        borderColor: borderStyle ? borderStyle.split(' ')[2] : 'none'
      });
    });
    
    console.log('\n📈 Classification Summary:');
    console.log(`  🟢 Signal: ${signalCount}`);
    console.log(`  🔴 Noise: ${noiseCount}`);
    console.log(`  ⚪ Unanalyzed: ${unanalyzedCount}`);
    
    if (signalCount + noiseCount > 0) {
      const ratio = ((signalCount / (signalCount + noiseCount)) * 100).toFixed(1);
      console.log(`  📊 Signal Ratio: ${ratio}%`);
    }
    
    console.log('\n📝 Tweet Details:');
    tweetDetails.forEach(tweet => {
      console.log(`\nTweet #${tweet.index} by @${tweet.author}`);
      console.log(`  Text: "${tweet.text}"`);
      console.log(`  Classification: ${tweet.classification} (${tweet.score})`);
      console.log(`  Border: ${tweet.borderColor}`);
      console.log(`  Signals:`, tweet.signals);
    });
  } else {
    console.log('  ⚠️ No tweets found. Try refreshing the page.');
  }

  // Phase 3: Manual Analysis Test
  console.log('\n%c🔬 Phase 3: Manual Analysis Test', 'color: #3b82f6; font-weight: bold; font-size: 12px');
  
  // Try to trigger analysis
  console.log('Attempting to trigger tweet analysis...');
  
  // Method 1: PostMessage
  window.postMessage({ type: 'SNR_ANALYZE_VISIBLE' }, '*');
  
  // Method 2: Dispatch custom event
  window.dispatchEvent(new CustomEvent('snr-refresh-analysis'));
  
  // Method 3: Storage event
  chrome.storage?.local?.set({ snr_refresh: Date.now() });
  
  console.log('  → Analysis triggered. Check for new badges in 2-3 seconds.');

  // Phase 4: Extension Settings Check
  console.log('\n%c⚙️ Phase 4: Extension Settings', 'color: #3b82f6; font-weight: bold; font-size: 12px');
  
  if (window.chrome && chrome.storage) {
    chrome.storage.local.get(['threshold', 'useAI', 'useLocalLLM', 'showIndicators', 'autoHide', 'debugMode'], (settings) => {
      console.log('Current Settings:');
      console.log(`  Threshold: ${settings.threshold || 30}%`);
      console.log(`  Show Indicators: ${settings.showIndicators !== false}`);
      console.log(`  Auto-hide Noise: ${settings.autoHide || false}`);
      console.log(`  AI Analysis: ${settings.useAI || false}`);
      console.log(`  Local LLM: ${settings.useLocalLLM || false}`);
      console.log(`  Debug Mode: ${settings.debugMode || false}`);
      
      if (!settings.debugMode) {
        console.log('\n💡 TIP: Press Ctrl+Shift+D to enable debug mode for detailed logs');
      }
    });
  } else {
    console.log('  ⚠️ Cannot access extension settings from this context');
  }

  // Phase 5: Recommendations
  console.log('\n%c💡 Phase 5: Recommendations', 'color: #3b82f6; font-weight: bold; font-size: 12px');
  
  if (!extensionPresent) {
    console.log('🔧 Extension Not Detected - Action Required:');
    console.log('  1. Go to chrome://extensions/');
    console.log('  2. Enable Developer Mode (top right)');
    console.log('  3. Click "Load unpacked"');
    console.log('  4. Select folder: /Users/pky/Code/signal_noise_ratio');
    console.log('  5. Return to X.com and refresh (F5)');
  } else if (tweets.length > 0 && signalCount + noiseCount === 0) {
    console.log('🔧 Extension Loaded but Not Analyzing:');
    console.log('  1. Click the extension icon in toolbar');
    console.log('  2. Check if analysis is enabled');
    console.log('  3. Try clicking "Refresh Analysis" button');
    console.log('  4. Check Console for error messages (red text)');
  } else if (signalCount + noiseCount > 0) {
    console.log('✅ Extension is Working!');
    console.log('  • Badges are showing on tweets');
    console.log('  • Analysis is functioning');
    console.log('\n🚀 To improve analysis accuracy:');
    console.log('  1. Start local LLM server:');
    console.log('     cd /Users/pky/Code/signal_noise_ratio && ./start-server.sh');
    console.log('  2. In extension settings, enable "Local LLM"');
  }

  // Phase 6: Live Monitoring
  console.log('\n%c👁️ Phase 6: Live Monitoring', 'color: #3b82f6; font-weight: bold; font-size: 12px');
  console.log('Starting 5-second monitor for new badges...');
  
  let initialBadgeCount = document.querySelectorAll('.sn-badge').length;
  
  setTimeout(() => {
    const newBadgeCount = document.querySelectorAll('.sn-badge').length;
    const change = newBadgeCount - initialBadgeCount;
    
    if (change > 0) {
      console.log(`✅ ${change} new badges appeared! Extension is actively analyzing.`);
    } else if (newBadgeCount > 0) {
      console.log(`✓ ${newBadgeCount} badges present. Extension is working.`);
    } else {
      console.log('❌ No badges detected after 5 seconds.');
    }
  }, 5000);

  console.log('\n========================================');
  console.log('%c Diagnostic Complete ', 'background: #10b981; color: white; padding: 5px 10px; border-radius: 5px; font-weight: bold;');
  console.log('Scroll down for more tweets to be analyzed.');
  console.log('Press Ctrl+Shift+D for debug mode.');
})();
