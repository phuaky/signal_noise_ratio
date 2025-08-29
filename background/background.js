// Background service worker for API calls

// Import logger
importScripts('../utils/logger.js');

// Initialize default settings
chrome.runtime.onInstalled.addListener(async () => {
  chrome.storage.local.set({
    autoHide: false,
    showIndicators: true,
    threshold: 30,
    useAI: false,
    useLocalLLM: true, // Always use local LLM
    enableParallelModels: false,
    enabledModels: {
      anthropic: false,
      openai: false,
      localLLM: true
    },
    // Logging settings
    enableLogStorage: true,
    logLevel: 'INFO',
    maxStoredLogs: 1000,
    logPerformanceMetrics: true,
    debugMode: false
  });
  
});

// Message handler for content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Analysis is now done directly in content script via local LLM
  // We only handle training data and connection status here
  
  // Handle LLM connection status updates
  if (request.action === 'llmConnectionStatus') {
    handleLLMConnectionStatus(request.connected, request.models, request.error);
    sendResponse({ received: true });
    return false;
  }
});

// Handle LLM connection status
function handleLLMConnectionStatus(connected, models, error) {
  // Update badge to show connection status
  const badgeText = connected ? 'ON' : 'OFF';
  const badgeColor = connected ? '#10b981' : '#ef4444';
  
  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });
  
  // Store status for popup
  if (connected) {
    chrome.storage.local.set({
      llmConnected: true,
      llmModels: models,
      llmLastError: null
    });
    
    extLog.info('LLM connected', { models });
  } else {
    chrome.storage.local.set({
      llmConnected: false,
      llmModels: [],
      llmLastError: error || 'Connection lost'
    });
    
    extLog.warn('LLM disconnected', { error });
  }
}
