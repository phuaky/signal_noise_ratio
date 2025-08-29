// Diagnostic script to test tweet detection
console.log('=== Signal/Noise Extension Diagnostic ===');

// Check if extension components are loaded
console.log('Checking extension components...');
console.log('- TweetAnalyzer:', typeof window.TweetAnalyzer !== 'undefined' ? '✓' : '✗');
console.log('- LLMService:', typeof window.LLMService !== 'undefined' ? '✓' : '✗');
console.log('- AnalysisQueue:', typeof window.AnalysisQueue !== 'undefined' ? '✓' : '✗');
console.log('- ViewportObserver:', typeof window.ViewportObserver !== 'undefined' ? '✓' : '✗');

// Check for tweets on page
const tweets = document.querySelectorAll('[data-testid="tweet"]');
console.log(`\nFound ${tweets.length} tweets on page`);

// Check for analyzed tweets
setTimeout(() => {
    const badges = document.querySelectorAll('.sn-indicator');
    console.log(`Found ${badges.length} analyzed tweets (badges)`);
    
    // Check each tweet
    tweets.forEach((tweet, index) => {
        const textEl = tweet.querySelector('[data-testid="tweetText"]');
        const text = textEl ? textEl.innerText : '[no text]';
        const hasBadge = tweet.querySelector('.sn-indicator') !== null;
        const preview = text.substring(0, 50) + (text.length > 50 ? '...' : '');
        console.log(`Tweet ${index + 1}: ${hasBadge ? '✓' : '✗'} "${preview}"`);
    });
    
    // Check LLM connection
    chrome.storage.local.get(['llmConnected', 'useLocalLLM'], (data) => {
        console.log('\nLLM Status:');
        console.log('- useLocalLLM:', data.useLocalLLM);
        console.log('- llmConnected:', data.llmConnected);
    });
    
    // Check settings
    chrome.storage.local.get(['enablePreAnalysis', 'threshold', 'debugMode'], (data) => {
        console.log('\nSettings:');
        console.log('- enablePreAnalysis:', data.enablePreAnalysis);
        console.log('- threshold:', data.threshold);
        console.log('- debugMode:', data.debugMode);
    });
    
}, 3000);

// Monitor new tweets
let tweetObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
                const tweets = node.querySelectorAll ? node.querySelectorAll('[data-testid="tweet"]') : [];
                if (tweets.length > 0) {
                    console.log(`[MutationObserver] Detected ${tweets.length} new tweet(s)`);
                }
                if (node.getAttribute && node.getAttribute('data-testid') === 'tweet') {
                    console.log('[MutationObserver] Detected new tweet (direct node)');
                }
            }
        });
    });
});

tweetObserver.observe(document.body, {
    childList: true,
    subtree: true
});

console.log('\nMonitoring for new tweets...');
console.log('=== Diagnostic Complete ===');