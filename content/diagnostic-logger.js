// Diagnostic Logger for Signal/Noise Extension
// This script adds comprehensive logging to help identify why tweets aren't being processed

(function() {
  console.log('=== Signal/Noise Diagnostic Logger Initialized ===');
  
  // Store original functions
  const originalAnalyzeTweet = window.TweetAnalyzer?.prototype?.analyzeTweet;
  const originalExtractTweetData = window.TweetAnalyzer?.prototype?.extractTweetData;
  
  // Track statistics
  const stats = {
    tweetsDetected: 0,
    tweetsWithText: 0,
    tweetsWithoutText: 0,
    analyzeCalled: 0,
    analyzeReturned: 0,
    analyzeReturnedNull: 0,
    llmCalls: 0,
    llmSuccess: 0,
    llmFailure: 0,
    startTime: Date.now()
  };
  
  // Log stats every 5 seconds
  setInterval(() => {
    const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
    console.log('📊 Extension Stats after', runtime, 'seconds:', stats);
  }, 5000);
  
  // Override TweetAnalyzer.extractTweetData to log what's extracted
  if (window.TweetAnalyzer && originalExtractTweetData) {
    window.TweetAnalyzer.prototype.extractTweetData = function(element) {
      const result = originalExtractTweetData.call(this, element);
      
      const hasText = result.text && result.text.trim().length > 0;
      stats.tweetsDetected++;
      if (hasText) {
        stats.tweetsWithText++;
        console.log('✅ Tweet extracted WITH text:', {
          textLength: result.text.length,
          preview: result.text.substring(0, 50) + '...',
          author: result.author?.handle || 'unknown'
        });
      } else {
        stats.tweetsWithoutText++;
        console.log('❌ Tweet extracted WITHOUT text:', {
          element: element,
          hasTextElement: !!element.querySelector('[data-testid="tweetText"]'),
          innerHTML: element.innerHTML.substring(0, 200) + '...'
        });
      }
      
      return result;
    };
  }
  
  // Override TweetAnalyzer.analyzeTweet to log analysis flow
  if (window.TweetAnalyzer && originalAnalyzeTweet) {
    window.TweetAnalyzer.prototype.analyzeTweet = async function(element, options) {
      stats.analyzeCalled++;
      console.log('🔍 analyzeTweet called, #', stats.analyzeCalled);
      
      const result = await originalAnalyzeTweet.call(this, element, options);
      
      stats.analyzeReturned++;
      if (result === null) {
        stats.analyzeReturnedNull++;
        console.log('⚠️ analyzeTweet returned NULL (tweet skipped)');
      } else {
        console.log('✅ analyzeTweet returned result:', {
          score: result.score,
          isSignal: result.isSignal,
          category: result.category
        });
      }
      
      return result;
    };
  }
  
  // Monitor LLM Service
  if (window.LLMService) {
    const originalAnalyzeTweetLLM = window.LLMService.prototype.analyzeTweet;
    
    window.LLMService.prototype.analyzeTweet = async function(text, prefs, data) {
      stats.llmCalls++;
      console.log('🤖 LLM Service called, #', stats.llmCalls, {
        connected: this.connected,
        textLength: text?.length || 0
      });
      
      try {
        const result = await originalAnalyzeTweetLLM.call(this, text, prefs, data);
        if (result) {
          stats.llmSuccess++;
          console.log('✅ LLM returned result');
        } else {
          stats.llmFailure++;
          console.log('❌ LLM returned null');
        }
        return result;
      } catch (error) {
        stats.llmFailure++;
        console.error('❌ LLM error:', error);
        throw error;
      }
    };
  }
  
  // Monitor MutationObserver
  const originalMutationObserver = window.MutationObserver;
  window.MutationObserver = function(callback) {
    const wrappedCallback = function(mutations, observer) {
      let tweetCount = 0;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            const tweets = node.querySelectorAll ? node.querySelectorAll('[data-testid="tweet"]') : [];
            tweetCount += tweets.length;
            if (node.getAttribute && node.getAttribute('data-testid') === 'tweet') {
              tweetCount++;
            }
          }
        });
      });
      
      if (tweetCount > 0) {
        console.log('👀 MutationObserver detected', tweetCount, 'new tweet(s)');
      }
      
      return callback.call(this, mutations, observer);
    };
    
    return new originalMutationObserver(wrappedCallback);
  };
  
  // Monitor analyzedTweets Map
  let analyzedTweetsMapProxy = null;
  Object.defineProperty(window, 'analyzedTweets', {
    get() {
      return analyzedTweetsMapProxy;
    },
    set(value) {
      if (value instanceof Map && !analyzedTweetsMapProxy) {
        console.log('📦 analyzedTweets Map initialized');
        
        // Wrap Map methods
        const originalSet = value.set.bind(value);
        const originalHas = value.has.bind(value);
        
        value.set = function(key, val) {
          console.log('📌 Tweet marked as analyzed:', {
            hasResult: !!val,
            isSignal: val?.isSignal
          });
          return originalSet(key, val);
        };
        
        value.has = function(key) {
          const result = originalHas(key);
          if (result) {
            console.log('🔄 Tweet already analyzed, skipping');
          }
          return result;
        };
      }
      analyzedTweetsMapProxy = value;
    }
  });
  
  // Check current page
  console.log('📍 Current URL:', window.location.href);
  console.log('📝 Initial tweet count:', document.querySelectorAll('[data-testid="tweet"]').length);
  
  // Check extension components
  console.log('🔧 Extension Components:');
  console.log('  - TweetAnalyzer:', typeof window.TweetAnalyzer !== 'undefined');
  console.log('  - LLMService:', typeof window.LLMService !== 'undefined');
  console.log('  - AnalysisQueue:', typeof window.AnalysisQueue !== 'undefined');
  console.log('  - ViewportObserver:', typeof window.ViewportObserver !== 'undefined');
  
  // Check settings
  chrome.storage.local.get(['useLocalLLM', 'enablePreAnalysis', 'threshold'], (settings) => {
    console.log('⚙️ Extension Settings:', settings);
  });
  
  console.log('=== Diagnostic Logger Ready - Watch console for activity ===');
})();