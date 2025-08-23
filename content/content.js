// Main content script
(function() {
  const analyzer = new TweetAnalyzer();
  const analyzedTweets = new Map();
  let trainingUI = null;
  let analysisQueue = null;
  let viewportObserver = null;
  let stats = {
    signalCount: 0,
    noiseCount: 0,
    totalAnalyzed: 0,
    categorizedCount: 0,
    queuedCount: 0,
    preAnalyzedCount: 0
  };
  let settings = {
    autoHide: false,
    showIndicators: true,
    threshold: 30,
    enableTraining: true,
    enablePreAnalysis: true,
    preAnalysisBatchSize: 5,
    preAnalysisLookAhead: 500,
    maxQueueSize: 100,
    debugMode: false
  };

  // Load settings
  chrome.storage.local.get(['autoHide', 'showIndicators', 'threshold', 'enableTraining', 'useWaveform', 
    'enablePreAnalysis', 'preAnalysisBatchSize', 'preAnalysisLookAhead', 'maxQueueSize', 'showReasoning', 'debugMode'], (stored) => {
    Object.assign(settings, stored);
    
    // Set global debug mode
    window.SNR_DEBUG = settings.debugMode || false;
    if (window.SNR_DEBUG) {
      extLog.info('Debug mode enabled');
    }
    
    // Initialize components
    if (settings.enablePreAnalysis && window.AnalysisQueue && window.ViewportObserver) {
      analysisQueue = new AnalysisQueue();
      analysisQueue.batchSize = settings.preAnalysisBatchSize || 5;
      analysisQueue.maxQueueSize = settings.maxQueueSize || 100;
      viewportObserver = new ViewportObserver(analysisQueue);
      viewportObserver.lookAheadPixels = settings.preAnalysisLookAhead || 500;
    }
    
    // Initialize training UI if enabled
    if (settings.enableTraining) {
      trainingUI = new TrainingUI();
      trainingUI.observeNewTweets();
    }
  });

  // Create floating dashboard
  const dashboard = createDashboard();
  document.body.appendChild(dashboard);
  
  // Initialize waveform after settings are loaded
  function initializeVisualization() {
    const useWaveform = settings.useWaveform !== false;
    const chartCanvas = document.getElementById('sn-mini-chart');
    const waveformCanvas = document.getElementById('sn-waveform');
    
    if (useWaveform) {
      // Show waveform, hide chart
      if (chartCanvas) chartCanvas.style.display = 'none';
      if (waveformCanvas) waveformCanvas.style.display = 'block';
      
      if (waveformCanvas && window.Waveform && !window.snWaveform) {
        // Check for dark mode
        const isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        window.snWaveform = new Waveform(waveformCanvas, {
          lineColor: isDarkMode ? '#34d399' : '#10b981',    // Green ECG line
          glowColor: isDarkMode ? '#6ee7b7' : '#34d399',    // Glow effect for spikes
          lineWidth: 2,
          samples: 150,     // More samples for smoother ECG
          speed: 0.02,      // Animation speed
          baselineMin: 10,  // Baseline hover range
          baselineMax: 20,
          spikeHeight: 80,  // Maximum spike height
          spikeWidth: 8     // Width of spikes
        });
        window.snWaveform.start();
        
        // Update colors on theme change
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
          window.snWaveform.setOptions({
            lineColor: e.matches ? '#34d399' : '#10b981',
            glowColor: e.matches ? '#6ee7b7' : '#34d399'
          });
        });
      }
    } else {
      // Show chart, hide waveform
      if (chartCanvas) chartCanvas.style.display = 'block';
      if (waveformCanvas) waveformCanvas.style.display = 'none';
      
      if (window.snWaveform) {
        window.snWaveform.stop();
      }
    }
  }
  
  // Call initialization after settings are loaded
  setTimeout(initializeVisualization, 100);

  // Initialize observer
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          const tweets = node.querySelectorAll('[data-testid="tweet"]');
          tweets.forEach(tweet => {
            if (settings.enablePreAnalysis && analysisQueue && viewportObserver) {
              handleTweetWithQueue(tweet);
            } else {
              analyzeTweetElement(tweet);
            }
          });
          
          // Also check if the node itself is a tweet
          if (node.matches && node.matches('[data-testid="tweet"]')) {
            if (settings.enablePreAnalysis && analysisQueue && viewportObserver) {
              handleTweetWithQueue(node);
            } else {
              analyzeTweetElement(node);
            }
          }
        }
      });
    });
  });

  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Analyze existing tweets
  document.querySelectorAll('[data-testid="tweet"]').forEach(tweet => {
    if (settings.enablePreAnalysis && analysisQueue && viewportObserver) {
      handleTweetWithQueue(tweet);
    } else {
      analyzeTweetElement(tweet);
    }
  });
  
  // Debug panel instance
  let debugPanel = null;

  // Add keyboard shortcut for debug mode toggle (Ctrl+Shift+D)
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      e.preventDefault();
      settings.debugMode = !settings.debugMode;
      window.SNR_DEBUG = settings.debugMode;
      chrome.storage.local.set({ debugMode: settings.debugMode });
      
      const status = settings.debugMode ? 'enabled' : 'disabled';
      extLog.info(`Debug mode ${status}`);
      
      // Toggle debug panel
      if (settings.debugMode) {
        if (!debugPanel && window.DebugPanel) {
          debugPanel = new window.DebugPanel();
          debugPanel.create();
          
          // Set global reference for logger
          window.__snrDebugPanel = debugPanel;
          window.debugPanel = debugPanel;
          
          // Listen for panel close event
          window.addEventListener('snr-debug-panel-closed', () => {
            debugPanel = null;
            window.__snrDebugPanel = null;
            window.debugPanel = null;
            settings.debugMode = false;
            window.SNR_DEBUG = false;
            chrome.storage.local.set({ debugMode: false });
          });
        }
      } else {
        if (debugPanel) {
          debugPanel.destroy();
          debugPanel = null;
        }
      }
      
      // Show visual feedback
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${settings.debugMode ? '#10b981' : '#6b7280'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: system-ui;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      `;
      notification.textContent = `Debug mode ${status}`;
      document.body.appendChild(notification);
      
      setTimeout(() => notification.remove(), 2000);
    }
  });

  function handleTweetWithQueue(element) {
    // Skip if already analyzed
    if (analyzedTweets.has(element)) return;
    
    // Skip ads and promoted tweets
    if (element.querySelector('[data-testid="promotedIndicator"]')) {
      analyzedTweets.set(element, { isAd: true });
      return;
    }
    
    // Determine priority based on viewport
    const isNearViewport = viewportObserver.isElementNearViewport(element);
    const priority = isNearViewport ? 'high' : 'low';
    
    // Add to queue
    analysisQueue.addTweet(element, priority, {
      analyzeTweetElement: async (el) => {
        await analyzeTweetElement(el);
        stats.preAnalyzedCount++;
      }
    });
    
    // Start observing for viewport changes
    viewportObserver.observe(element);
    
    // Update stats
    stats.queuedCount = analysisQueue.getQueueStats().highPriority + 
                       analysisQueue.getQueueStats().lowPriority;
  }

  async function analyzeTweetElement(element) {
    // Skip if already analyzed
    if (analyzedTweets.has(element)) return;

    // Skip ads and promoted tweets
    if (element.querySelector('[data-testid="promotedIndicator"]')) {
      analyzedTweets.set(element, { isAd: true });
      return;
    }

    // Analyze tweet
    const result = await analyzer.analyzeTweet(element);
    
    // If no result (LLM not available), skip this tweet
    if (!result) {
      if (window.SNR_DEBUG) {
        extLog.debug('No analysis available - LLM not connected');
      }
      return;
    }
    
    // Get category prediction if training is enabled
    if (settings.enableTraining && trainingUI) {
      try {
        const tweetData = trainingUI.extractTweetData(element);
        const response = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            extLog.warn('Category prediction timed out');
            resolve(null);
          }, 2000); // 2 second timeout
          
          chrome.runtime.sendMessage({
            action: 'predictCategory',
            tweetData: tweetData
          }, (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              extLog.warn('Chrome runtime error', { error: chrome.runtime.lastError.message });
              resolve(null);
            } else {
              resolve(response);
            }
          });
        });
        
        if (response && response.prediction) {
          result.category = response.prediction.category;
          result.categoryConfidence = response.prediction.confidence;
          stats.categorizedCount++;
        }
      } catch (error) {
        extLog.error('Category prediction failed', { error: error.message, stack: error.stack });
      }
    }
    
    analyzedTweets.set(element, result);

    // Update stats
    stats.totalAnalyzed++;
    if (result.isSignal) {
      stats.signalCount++;
    } else {
      stats.noiseCount++;
    }
    
    // Store stats for debug panel
    chrome.storage.local.set({ 
      snr_stats: stats 
    });

    // Update debug panel if active
    if (debugPanel) {
      debugPanel.updateLastAnalysis(result);
      debugPanel.addLog(
        result.isSignal ? 'INFO' : 'DEBUG',
        `Analyzed tweet: ${result.isSignal ? 'Signal' : 'Noise'} (${result.score})`,
        {
          score: result.score,
          confidence: result.confidence,
          method: result.method,
          latency: result.latency,
          reason: result.reason
        }
      );
    }

    // Apply visual indicators
    if (settings.showIndicators) {
      applyVisualIndicator(element, result);
    }

    // Auto-hide if enabled
    if (settings.autoHide && !result.isSignal) {
      element.style.opacity = '0.3';
      element.style.filter = 'blur(2px)';
      element.style.transition = 'opacity 0.3s, filter 0.3s';
      
      // Add hover effect to reveal
      element.addEventListener('mouseenter', () => {
        element.style.opacity = '1';
        element.style.filter = 'none';
      });
      
      element.addEventListener('mouseleave', () => {
        element.style.opacity = '0.3';
        element.style.filter = 'blur(2px)';
      });
    }

    // Update dashboard
    updateDashboard();
  }

  function applyVisualIndicator(element, result) {
    // Remove any existing indicator
    const existingIndicator = element.querySelector('.sn-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    // Create indicator
    const indicator = document.createElement('div');
    indicator.className = 'sn-indicator';
    
    let badgeContent = `
      <span class="sn-score">${result.score}%</span>
      <span class="sn-label">${result.isSignal ? 'Signal' : 'Noise'}</span>
    `;
    
    // Add category if predicted
    if (result.category) {
      badgeContent += `<span class="sn-category-label" style="margin-left: 6px; font-size: 10px; opacity: 0.8;">${result.category}</span>`;
    }
    
    // Add reasoning tooltip if enabled and available
    let reasoningTooltip = '';
    if (settings.showReasoning && result.reason) {
      reasoningTooltip = `
        <div class="sn-reasoning-tooltip" style="
          display: none;
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          white-space: normal;
          max-width: 300px;
          z-index: 1000;
          pointer-events: none;
        ">
          <div style="font-weight: bold; margin-bottom: 4px;">AI Reasoning:</div>
          ${result.reason}
          <div style="font-size: 10px; opacity: 0.7; margin-top: 4px;">via ${result.confidence || 'analysis'}</div>
        </div>
      `;
    }
    
    // Determine badge class based on category
    let badgeClass = 'noise';
    if (result.category === 'high-signal') {
      badgeClass = 'high-signal';
    } else if (result.category === 'signal' || result.isSignal) {
      badgeClass = 'signal';
    } else if (result.category === 'medium') {
      badgeClass = 'medium';
    }
    
    indicator.innerHTML = `
      <div class="sn-badge ${badgeClass}" style="position: relative;">
        ${badgeContent}
        ${reasoningTooltip}
      </div>
    `;

    // Find the best place to insert indicator
    const actionBar = element.querySelector('[role="group"]');
    if (actionBar) {
      actionBar.style.position = 'relative';
      actionBar.appendChild(indicator);
    } else {
      element.style.position = 'relative';
      element.appendChild(indicator);
    }

    // Add hover events for reasoning tooltip
    if (settings.showReasoning && result.reason) {
      const badge = indicator.querySelector('.sn-badge');
      const tooltip = indicator.querySelector('.sn-reasoning-tooltip');
      
      badge.addEventListener('mouseenter', () => {
        if (tooltip) tooltip.style.display = 'block';
      });
      
      badge.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.style.display = 'none';
      });
    }

    // Add border based on category
    let borderColor = '#ef4444'; // Default red for noise
    if (result.category === 'high-signal') {
      borderColor = '#10b981'; // Green
    } else if (result.category === 'signal' || result.isSignal) {
      borderColor = '#10b981'; // Green
    } else if (result.category === 'medium') {
      borderColor = '#f59e0b'; // Amber
    }
    
    element.style.borderLeft = `3px solid ${borderColor}`;
    element.style.transition = 'border-color 0.3s';
  }

  function createDashboard() {
    const dashboard = document.createElement('div');
    dashboard.className = 'sn-dashboard';
    dashboard.innerHTML = `
      <div class="sn-dashboard-header">
        <h3>Signal/Noise Ratio</h3>
        <button class="sn-dashboard-toggle">−</button>
      </div>
      <div class="sn-dashboard-content">
        <div class="sn-stat">
          <span class="sn-stat-value signal" id="sn-signal-count">0</span>
          <span class="sn-stat-label">Signal</span>
        </div>
        <div class="sn-stat">
          <span class="sn-stat-value noise" id="sn-noise-count">0</span>
          <span class="sn-stat-label">Noise</span>
        </div>
        <div class="sn-stat">
          <span class="sn-stat-value ratio" id="sn-ratio">0%</span>
          <span class="sn-stat-label">Ratio</span>
        </div>
      </div>
      <div class="sn-queue-status" id="sn-queue-status" style="display: none; margin: 8px; font-size: 11px; color: #6b7280;">
        <span>Queue: <span id="sn-queue-count">0</span></span>
        <span style="margin-left: 10px;">Pre-analyzed: <span id="sn-preanalyzed-count">0</span></span>
      </div>
      <div class="sn-dashboard-chart">
        <canvas id="sn-mini-chart" width="200" height="50"></canvas>
        <canvas id="sn-waveform" width="200" height="50" style="display: none;"></canvas>
      </div>
    `;

    // Add toggle functionality
    const toggle = dashboard.querySelector('.sn-dashboard-toggle');
    const content = dashboard.querySelector('.sn-dashboard-content');
    const chart = dashboard.querySelector('.sn-dashboard-chart');
    
    toggle.addEventListener('click', () => {
      const isCollapsed = content.style.display === 'none';
      content.style.display = isCollapsed ? 'flex' : 'none';
      chart.style.display = isCollapsed ? 'block' : 'none';
      toggle.textContent = isCollapsed ? '−' : '+';
    });

    return dashboard;
  }

  function updateDashboard() {
    const ratio = stats.totalAnalyzed > 0 
      ? Math.round((stats.signalCount / stats.totalAnalyzed) * 100)
      : 0;

    document.getElementById('sn-signal-count').textContent = stats.signalCount;
    document.getElementById('sn-noise-count').textContent = stats.noiseCount;
    document.getElementById('sn-ratio').textContent = `${ratio}%`;

    // Update queue status if pre-analysis is enabled
    if (settings.enablePreAnalysis && analysisQueue) {
      const queueStats = analysisQueue.getQueueStats();
      const queueStatus = document.getElementById('sn-queue-status');
      if (queueStatus) {
        queueStatus.style.display = 'block';
        document.getElementById('sn-queue-count').textContent = queueStats.highPriority + queueStats.lowPriority;
        document.getElementById('sn-preanalyzed-count').textContent = stats.preAnalyzedCount;
      }
    }

    // Update mini chart
    updateMiniChart(ratio);
    
    // Update waveform
    if (window.snWaveform) {
      window.snWaveform.updateRatio(ratio);
    }
  }

  function updateMiniChart(ratio) {
    const canvas = document.getElementById('sn-mini-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Initialize chart data
    if (!window.snChartData) {
      window.snChartData = [];
    }

    // Add new data point
    window.snChartData.push(ratio);
    if (window.snChartData.length > 20) {
      window.snChartData.shift();
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (window.snChartData.length < 2) return;

    // Draw line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.beginPath();

    window.snChartData.forEach((value, index) => {
      const x = (width / (window.snChartData.length - 1)) * index;
      const y = height - (value / 100 * height);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }

  // Message handling
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'getStats':
        sendResponse(stats);
        break;
      
      case 'updateSettings':
        Object.assign(settings, request.settings);
        analyzer.settings.threshold = settings.threshold;
        
        // Reinitialize visualization if waveform setting changed
        initializeVisualization();
        
        // Update queue settings if enabled
        if (settings.enablePreAnalysis && analysisQueue) {
          analysisQueue.batchSize = settings.preAnalysisBatchSize || 5;
          analysisQueue.maxQueueSize = settings.maxQueueSize || 100;
          if (viewportObserver) {
            viewportObserver.updateLookAhead(settings.preAnalysisLookAhead || 500);
          }
        }
        
        // Initialize or destroy pre-analysis components
        if (settings.enablePreAnalysis && !analysisQueue && window.AnalysisQueue && window.ViewportObserver) {
          analysisQueue = new AnalysisQueue();
          analysisQueue.batchSize = settings.preAnalysisBatchSize || 5;
          analysisQueue.maxQueueSize = settings.maxQueueSize || 100;
          viewportObserver = new ViewportObserver(analysisQueue);
          viewportObserver.lookAheadPixels = settings.preAnalysisLookAhead || 500;
        } else if (!settings.enablePreAnalysis && analysisQueue) {
          analysisQueue.clear();
          analysisQueue = null;
          if (viewportObserver) {
            viewportObserver.disconnect();
            viewportObserver = null;
          }
        }
        
        // Initialize or destroy training UI based on setting
        if (settings.enableTraining && !trainingUI) {
          trainingUI = new TrainingUI();
          trainingUI.observeNewTweets();
        } else if (!settings.enableTraining && trainingUI) {
          // Clean up training UI
          document.querySelector('.sn-training-toggle')?.remove();
          document.querySelector('.sn-category-selector')?.remove();
          trainingUI = null;
        }
        
        // Re-analyze all tweets with new settings
        analyzedTweets.clear();
        stats = { signalCount: 0, noiseCount: 0, totalAnalyzed: 0, categorizedCount: 0, queuedCount: 0, preAnalyzedCount: 0 };
        document.querySelectorAll('[data-testid="tweet"]').forEach(tweet => {
          if (settings.enablePreAnalysis && analysisQueue && viewportObserver) {
            handleTweetWithQueue(tweet);
          } else {
            analyzeTweetElement(tweet);
          }
        });
        break;
      
      case 'refresh':
        // Clear and re-analyze
        analyzedTweets.clear();
        stats = { signalCount: 0, noiseCount: 0, totalAnalyzed: 0, categorizedCount: 0, queuedCount: 0, preAnalyzedCount: 0 };
        
        // Clear queue if enabled
        if (analysisQueue) {
          analysisQueue.clear();
        }
        
        // Remove all indicators
        document.querySelectorAll('.sn-indicator').forEach(el => el.remove());
        document.querySelectorAll('[data-testid="tweet"]').forEach(el => {
          el.style.borderLeft = '';
          el.style.opacity = '';
          el.style.filter = '';
        });
        
        // Re-analyze
        document.querySelectorAll('[data-testid="tweet"]').forEach(tweet => {
          if (settings.enablePreAnalysis && analysisQueue && viewportObserver) {
            handleTweetWithQueue(tweet);
          } else {
            analyzeTweetElement(tweet);
          }
        });
        sendResponse(stats);
        break;
        
      case 'analyzeWithLocalLLM':
        // Forward to LLM service if available
        if (window.llmServiceInstance) {
          window.llmServiceInstance.analyzeTweet(request.text)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
          return true; // Keep channel open
        } else {
          sendResponse({ error: 'LLM service not initialized' });
        }
        break;
    }
    
    return true; // Keep message channel open for async response
  });
})();