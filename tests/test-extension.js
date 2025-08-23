// Signal/Noise Ratio Extension - Comprehensive Test Suite
// Paste this into Chrome DevTools Console while on X.com

console.clear();
console.log('%c🧪 Signal/Noise Extension Testing', 'background: #3b82f6; color: white; padding: 8px 15px; border-radius: 8px; font-weight: bold; font-size: 16px');
console.log('=====================================\n');

// Check for extension elements - updated with correct class names
const checkExtension = () => {
  const results = {};
  
  // Look for extension-specific elements (checking both possible class name patterns)
  results.indicators = document.querySelectorAll('.sn-indicator, .snr-indicator').length;
  results.badges = document.querySelectorAll('.sn-badge, .snr-badge').length;
  results.dashboard = document.querySelector('.sn-dashboard, .snr-dashboard') !== null;
  results.waveform = document.querySelector('#sn-waveform, .snr-waveform') !== null;
  results.debugPanel = document.querySelector('.snr-debug-panel') !== null;
  
  // Check for tweets
  results.tweets = document.querySelectorAll('article[data-testid="tweet"]').length;
  
  // Check for analyzed tweets (multiple possible attributes)
  results.analyzedTweets = document.querySelectorAll('[data-sn-analyzed="true"], [data-snr-analyzed="true"], .sn-badge, .snr-badge').length;
  
  return results;
};

const results = checkExtension();

console.log('%c📍 Extension Detection', 'color: #3b82f6; font-weight: bold; font-size: 14px');
console.log('  Tweets on page:', results.tweets);
console.log('  Analyzed tweets:', results.analyzedTweets);
console.log('  SNR indicators:', results.indicators);
console.log('  SNR badges:', results.badges);
console.log('  Dashboard present:', results.dashboard);
console.log('  Waveform present:', results.waveform);
console.log('  Debug panel:', results.debugPanel);

// Detailed tweet analysis
console.log('\n%c📊 Tweet Analysis Details', 'color: #3b82f6; font-weight: bold; font-size: 14px');

const tweets = document.querySelectorAll('article[data-testid="tweet"]');
let signalCount = 0;
let noiseCount = 0;
const sampleTweets = [];

// Analyze first 5 tweets in detail
for (let i = 0; i < Math.min(5, tweets.length); i++) {
  const tweet = tweets[i];
  const text = tweet.querySelector('[data-testid="tweetText"]')?.innerText || '';
  const author = tweet.querySelector('[data-testid="User-Name"] span')?.innerText || 'Unknown';
  
  // Check for badges (both class patterns)
  const badge = tweet.querySelector('.sn-badge, .snr-badge');
  const indicator = tweet.querySelector('.sn-indicator, .snr-indicator');
  
  let classification = 'Unanalyzed';
  let score = 'N/A';
  
  if (badge) {
    const scoreEl = badge.querySelector('.sn-score, .snr-score');
    const labelEl = badge.querySelector('.sn-label, .snr-label');
    
    if (scoreEl) score = scoreEl.innerText;
    if (labelEl) {
      classification = labelEl.innerText;
      if (classification.toLowerCase().includes('signal')) signalCount++;
      if (classification.toLowerCase().includes('noise')) noiseCount++;
    }
  }
  
  sampleTweets.push({
    index: i + 1,
    author: author.substring(0, 30),
    text: text.substring(0, 60) + '...',
    classification,
    score,
    hasBadge: !!badge,
    hasIndicator: !!indicator
  });
}

console.log(`Analyzed ${sampleTweets.length} sample tweets:`);
sampleTweets.forEach(t => {
  const icon = t.classification === 'Signal' ? '🟢' : t.classification === 'Noise' ? '🔴' : '⚪';
  console.log(`  ${icon} Tweet #${t.index} by @${t.author}`);
  console.log(`     "${t.text}"`);
  console.log(`     Status: ${t.classification} (${t.score})`);
});

console.log(`\n📈 Summary: ${signalCount} Signal, ${noiseCount} Noise`);

// Check extension functionality
if (results.indicators > 0 || results.badges > 0 || results.dashboard) {
  console.log('\n%c✅ Extension is Active!', 'background: #10b981; color: white; padding: 5px 10px; border-radius: 5px; font-weight: bold');
  
  if (signalCount + noiseCount > 0) {
    const ratio = (signalCount / (signalCount + noiseCount) * 100).toFixed(1);
    console.log(`Signal/Noise Ratio: ${ratio}%`);
  }
  
  // Try to read settings if available
  if (window.chrome && chrome.storage) {
    chrome.storage.local.get(['threshold', 'useAI', 'useLocalLLM'], (settings) => {
      console.log('\n⚙️ Current Settings:');
      console.log('  Threshold:', settings.threshold || 30);
      console.log('  AI Analysis:', settings.useAI || false);
      console.log('  Local LLM:', settings.useLocalLLM || false);
    });
  }
} else {
  console.log('\n%c❌ Extension Not Active', 'background: #ef4444; color: white; padding: 5px 10px; border-radius: 5px; font-weight: bold');
  console.log('\n🔧 Troubleshooting Steps:');
  console.log('1. Open chrome://extensions/');
  console.log('2. Enable Developer Mode (top right)');
  console.log('3. Click "Load unpacked"');
  console.log('4. Select the signal_noise_ratio folder');
  console.log('5. Return here and refresh (F5)');
}

// Try to trigger analysis
console.log('\n%c🔄 Triggering Analysis', 'color: #3b82f6; font-weight: bold; font-size: 14px');
console.log('Sending analysis trigger messages...');

// Multiple trigger attempts
window.postMessage({ type: 'SNR_ANALYZE_VISIBLE' }, '*');
window.dispatchEvent(new CustomEvent('snr-refresh-analysis'));

// Monitor for changes
const initialBadges = document.querySelectorAll('.sn-badge, .snr-badge').length;
console.log(`Current badges: ${initialBadges}`);
console.log('Waiting 3 seconds for new badges...');

setTimeout(() => {
  const newBadges = document.querySelectorAll('.sn-badge, .snr-badge').length;
  const change = newBadges - initialBadges;
  
  if (change > 0) {
    console.log(`✅ ${change} new badges appeared! Analysis is working.`);
  } else if (newBadges > 0) {
    console.log(`ℹ️ ${newBadges} badges present (no change).`);
  } else {
    console.log('❌ No badges detected. Extension may not be active.');
  }
  
  console.log('\n=====================================');
  console.log('Test complete. Results saved to window.SNR_TEST');
}, 3000);

// Save results for debugging
window.SNR_TEST = {
  results,
  sampleTweets,
  signalCount,
  noiseCount,
  timestamp: new Date().toISOString()
};

console.log('\nPress Ctrl+Shift+D to toggle debug mode');
